export interface ParsedInt16Tiff {
  width: number;
  height: number;
  data: Int16Array;
  noData: number;
}

export type InflateFn = (compressed: Uint8Array) => Promise<Uint8Array>;

/** Descomprime flujo zlib/deflate leyendo concurrentemente para evitar deadlock de backpressure. */
export async function browserInflateZlib(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const reader = ds.readable.getReader();
  const readPromise = (async () => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  })();

  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  await writer.write(copy);
  await writer.close();
  return readPromise;
}

function readTagValues(
  view: DataView,
  type: number,
  count: number,
  valueOrOffset: number,
  littleEndian: boolean
): number[] {
  const typeSize = type === 3 ? 2 : type === 4 ? 4 : type === 1 ? 1 : 0;
  if (typeSize === 0) return [];
  const totalBytes = count * typeSize;
  const start = totalBytes <= 4 ? -1 : valueOrOffset;

  const out: number[] = [];
  if (start < 0) {
    // Valores empaquetados en el campo de 4 bytes del IFD
    for (let i = 0; i < count; i++) {
      if (type === 3) {
        const shift = littleEndian ? i * 16 : (1 - i) * 16;
        out.push((valueOrOffset >>> shift) & 0xffff);
      } else if (type === 4) {
        out.push(valueOrOffset >>> 0);
      } else {
        const shift = littleEndian ? i * 8 : (3 - i) * 8;
        out.push((valueOrOffset >>> shift) & 0xff);
      }
    }
    return out;
  }

  for (let i = 0; i < count; i++) {
    const pos = start + i * typeSize;
    if (type === 3) out.push(view.getUint16(pos, littleEndian));
    else if (type === 4) out.push(view.getUint32(pos, littleEndian));
    else out.push(view.getUint8(pos));
  }
  return out;
}

function readAsciiTag(
  bytes: Uint8Array,
  count: number,
  valueOrOffset: number
): string {
  const start = count <= 4 ? -1 : valueOrOffset;
  if (start < 0) return '';
  let text = '';
  for (let i = 0; i < count; i++) {
    const ch = bytes[start + i];
    if (ch === 0) break;
    text += String.fromCharCode(ch);
  }
  return text.trim();
}

/**
 * Lector ligero de GeoTIFF INT16 (tiles o strips, sin compresión o Deflate + Predictor=2)
 * para consumir coberturas WCS de SoilGrids 2.0 directamente en el navegador.
 */
export async function parseInt16GeoTiff(
  buffer: ArrayBuffer,
  inflateFn: InflateFn = browserInflateZlib
): Promise<ParsedInt16Tiff> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const bom = String.fromCharCode(bytes[0], bytes[1]);
  if (bom !== 'II' && bom !== 'MM') {
    throw new Error('Respuesta no es un GeoTIFF válido.');
  }
  const le = bom === 'II';
  const magic = view.getUint16(2, le);
  if (magic !== 42) {
    throw new Error(`Versión TIFF no soportada: ${magic}`);
  }

  const ifdOffset = view.getUint32(4, le);
  const tagCount = view.getUint16(ifdOffset, le);

  let width = 0;
  let height = 0;
  let compression = 1;
  let predictor = 1;
  let tileWidth = 0;
  let tileLength = 0;
  let tileOffsets: number[] = [];
  let tileByteCounts: number[] = [];
  let stripOffsets: number[] = [];
  let stripByteCounts: number[] = [];
  let rowsPerStrip = 0;
  let noData = -32768;

  for (let i = 0; i < tagCount; i++) {
    const entry = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entry, le);
    const type = view.getUint16(entry + 2, le);
    const count = view.getUint32(entry + 4, le);
    const valOffset = view.getUint32(entry + 8, le);

    if (tag === 256) width = readTagValues(view, type, count, valOffset, le)[0] ?? 0;
    else if (tag === 257) height = readTagValues(view, type, count, valOffset, le)[0] ?? 0;
    else if (tag === 259) compression = readTagValues(view, type, count, valOffset, le)[0] ?? 1;
    else if (tag === 273) stripOffsets = readTagValues(view, type, count, valOffset, le);
    else if (tag === 278) rowsPerStrip = readTagValues(view, type, count, valOffset, le)[0] ?? height;
    else if (tag === 279) stripByteCounts = readTagValues(view, type, count, valOffset, le);
    else if (tag === 317) predictor = readTagValues(view, type, count, valOffset, le)[0] ?? 1;
    else if (tag === 322) tileWidth = readTagValues(view, type, count, valOffset, le)[0] ?? 0;
    else if (tag === 323) tileLength = readTagValues(view, type, count, valOffset, le)[0] ?? 0;
    else if (tag === 324) tileOffsets = readTagValues(view, type, count, valOffset, le);
    else if (tag === 325) tileByteCounts = readTagValues(view, type, count, valOffset, le);
    else if (tag === 42113) {
      const txt = readAsciiTag(bytes, count, valOffset);
      const parsed = Number(txt);
      if (Number.isFinite(parsed)) noData = parsed;
    }
  }

  if (width <= 0 || height <= 0) {
    throw new Error('Dimensiones inválidas en GeoTIFF.');
  }

  const out = new Int16Array(width * height);
  out.fill(noData);

  const decodeChunk = async (offset: number, byteCount: number): Promise<Uint8Array> => {
    const slice = bytes.subarray(offset, offset + byteCount);
    if (compression === 1) return slice;
    if (compression === 8 || compression === 32946) return inflateFn(slice);
    throw new Error(`Compresión TIFF no soportada: ${compression}`);
  };

  if (tileOffsets.length > 0 && tileWidth > 0 && tileLength > 0) {
    const tilesAcross = Math.ceil(width / tileWidth);
    for (let tIdx = 0; tIdx < tileOffsets.length; tIdx++) {
      const raw = await decodeChunk(tileOffsets[tIdx], tileByteCounts[tIdx]);
      const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const tileCol = tIdx % tilesAcross;
      const tileRow = Math.floor(tIdx / tilesAcross);
      const x0 = tileCol * tileWidth;
      const y0 = tileRow * tileLength;

      for (let ty = 0; ty < tileLength; ty++) {
        const destY = y0 + ty;
        let acc = 0;
        for (let tx = 0; tx < tileWidth; tx++) {
          const idx = ty * tileWidth + tx;
          const v = rawView.getInt16(idx * 2, le);
          const decoded = predictor === 2 ? ((acc + v) << 16) >> 16 : v;
          acc = decoded;
          const destX = x0 + tx;
          if (destX < width && destY < height) {
            out[destY * width + destX] = decoded;
          }
        }
      }
    }
    return { width, height, data: out, noData };
  }

  if (stripOffsets.length > 0) {
    const stripRows = rowsPerStrip || height;
    for (let sIdx = 0; sIdx < stripOffsets.length; sIdx++) {
      const raw = await decodeChunk(stripOffsets[sIdx], stripByteCounts[sIdx]);
      const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const y0 = sIdx * stripRows;
      const maxRows = Math.min(stripRows, height - y0);
      for (let sy = 0; sy < maxRows; sy++) {
        let acc = 0;
        for (let x = 0; x < width; x++) {
          const idx = sy * width + x;
          const v = rawView.getInt16(idx * 2, le);
          const decoded = predictor === 2 ? ((acc + v) << 16) >> 16 : v;
          acc = decoded;
          out[(y0 + sy) * width + x] = decoded;
        }
      }
    }
    return { width, height, data: out, noData };
  }

  throw new Error('GeoTIFF sin tiles ni strips legibles.');
}

export type OperationalSoilClass = 'arena' | 'limo-polvo' | 'arcilla' | 'franco-mixto';

export interface SoilClassification {
  kind: OperationalSoilClass;
  label: string;
  rgb: [number, number, number];
}

/**
 * Clasifica la textura superficial (0–5 cm) en clases operativas para análogos
 * (movilidad de rovers, cohesión y polvo fino).
 */
export function classifyOperationalSoil(
  clayPct: number,
  sandPct: number,
  siltPct: number
): SoilClassification {
  if (sandPct >= 65) {
    return { kind: 'arena', label: 'Arena / Suelo arenoso', rgb: [245, 158, 11] };
  }
  if (siltPct >= 45) {
    return { kind: 'limo-polvo', label: 'Limo / Polvo fino', rgb: [250, 204, 21] };
  }
  if (clayPct >= 35) {
    return { kind: 'arcilla', label: 'Arcilla cohesiva', rgb: [239, 68, 68] };
  }
  // Teal en lugar de #38bdf8 para no camuflarse con el contorno cian de zonas Lunares
  return { kind: 'franco-mixto', label: 'Franco / Mixto consolidado', rgb: [20, 184, 166] };
}
