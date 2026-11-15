// Ficha física determinista de un candidato: qué coincide, qué difiere, qué no puntúa y qué ningún dato captura.
// Solo usa números de metrics.json y resultados/*.json; no inventa nada. La misma regla de hielo que el visor.

const fmt = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? 'sin dato' : Number(x).toFixed(d));

export function pareceHielo(lat, lon) {
  return lat > 60 && lon > -75 && lon < -10;
}

export function explicarCandidato({ indice, resultado, candidato }) {
  const vars = new Map((indice.variables ?? []).map((v) => [v.id, v]));
  const nombre = (id) => vars.get(id)?.nombre ?? id;
  const unidad = (id) => vars.get(id)?.unidad ?? '';
  const sitio = (indice.sitios_objetivo ?? []).find((s) => s.id === resultado.sitio);
  const cuerpoId = sitio?.cuerpo ?? 'marte';
  const cuerpo = indice.cuerpos?.[cuerpoId] ?? null;
  const tierra = indice.cuerpos?.tierra ?? null;

  const variables = resultado.parametros.variables.map((p) => {
    const c = candidato.variables[p.id] ?? { valor: null, diferencia: null, nota: null, etiqueta: 'sin_dato' };
    const obj = resultado.objetivo.variables[p.id];
    return {
      id: p.id,
      nombre: nombre(p.id),
      unidad: unidad(p.id),
      valor_tierra: c.valor,
      valor_objetivo: obj?.valor ?? null,
      valor_objetivo_real: obj?.valor_real ?? null,
      diferencia: c.diferencia,
      tolerancia: p.tolerancia,
      peso: p.peso,
      nota: c.nota,
      etiqueta: c.etiqueta,
      fuente: p.origen?.fuente ?? null,
      licencia: p.origen?.licencia ?? null,
    };
  });

  const diagnostico = Object.entries(candidato.diagnostico ?? {}).map(([id, d]) => ({
    id,
    nombre: nombre(id),
    unidad: unidad(id),
    valor_tierra: d.valor,
    valor_objetivo: d.objetivo,
    diferencia: d.diferencia,
    nota: 'No puntúa: la atmósfera de la Tierra amortigua la temperatura y este rango no se alcanza en la Tierra.',
  }));

  const diferencias_planetarias =
    tierra && cuerpo
      ? {
          gravedad_ms2: { tierra: tierra.gravedad_ms2, objetivo: cuerpo.gravedad_ms2 },
          presion_superficie_pa: { tierra: tierra.presion_superficie_pa, objetivo: cuerpo.presion_superficie_pa },
          atmosfera: { tierra: tierra.atmosfera, objetivo: cuerpo.atmosfera },
          radiacion: { tierra: tierra.radiacion, objetivo: cuerpo.radiacion },
          fuente: [tierra.fuente, cuerpo.fuente],
        }
      : null;

  const advertencias = [];
  if (pareceHielo(candidato.centro.lat, candidato.centro.lon)) {
    advertencias.push('Puede caer sobre hielo: el filtro de vegetación no lo distingue.');
  }
  if (candidato.cobertura.faltan.length > 0) {
    advertencias.push(`Faltan datos de: ${candidato.cobertura.faltan.map(nombre).join(', ')}. La nota usa solo las presentes.`);
  }
  for (const v of variables) {
    if (v.valor_objetivo_real !== null && v.valor_objetivo_real !== v.valor_objetivo) {
      advertencias.push(
        `${v.nombre}: el valor real del objetivo (${fmt(v.valor_objetivo_real)}) está fuera del alcance de la Tierra; se buscó ${fmt(v.valor_objetivo)}.`,
      );
    }
  }

  return {
    objetivo: { id: resultado.sitio, nombre: sitio?.nombre ?? resultado.sitio, cuerpo: cuerpoId },
    perfil: resultado.perfil,
    candidato: {
      rango: candidato.rango,
      ipix: candidato.ipix,
      nivel_healpix: resultado.healpix?.nivel ?? null,
      lat: candidato.centro.lat,
      lon: candidato.centro.lon,
      nota: candidato.nota,
      region: candidato.region,
      analogo_conocido: candidato.analogo_conocido,
      cobertura: candidato.cobertura,
    },
    coinciden: variables.filter((v) => v.etiqueta === 'coincide'),
    difieren: variables.filter((v) => v.etiqueta === 'difiere'),
    sin_dato: variables.filter((v) => v.etiqueta === 'sin_dato'),
    diagnostico_no_puntua: diagnostico,
    cerca_de: candidato.cerca_de ?? null,
    diferencias_planetarias,
    advertencias,
    metodo: {
      gamma: resultado.parametros.gamma,
      lambda_contraccion: resultado.parametros.lambda_contraccion,
      ndvi_max: resultado.parametros.ndvi_max,
      formula: 'S = exp(-gamma·D²), D² de Mahalanobis con pseudo-Huber por tolerancia (ADR-010)',
    },
    tabla: indice.contrato?.tabla ?? null,
  };
}

function filaVar(v) {
  const u = v.unidad ? ` ${v.unidad}` : '';
  return `| ${v.nombre} | ${fmt(v.valor_tierra)}${u} | ${fmt(v.valor_objetivo)}${u} | ${fmt(v.diferencia)} | ${fmt(v.tolerancia)} | ${v.etiqueta} |`;
}

export function explicacionAMarkdown(e) {
  const l = [];
  const c = e.candidato;
  l.push(`## Candidato #${c.rango} para ${e.objetivo.nombre} (${e.objetivo.id}, ${e.objetivo.cuerpo}), perfil ${e.perfil}`);
  l.push('');
  l.push(`Centro ${fmt(c.lat, 4)}, ${fmt(c.lon, 4)} · nota ${(c.nota * 100).toFixed(1)} % · cobertura ${c.cobertura.usadas}/${c.cobertura.total}` +
    (c.analogo_conocido ? ` · análogo conocido: ${c.analogo_conocido}` : ''));
  l.push('');
  l.push('| Variable | Tierra | Objetivo | Diferencia | Tolerancia | Etiqueta |');
  l.push('| :-- | --: | --: | --: | --: | :-- |');
  for (const v of [...e.coinciden, ...e.difieren, ...e.sin_dato]) l.push(filaVar(v));
  l.push('');
  l.push(`**Coincide en:** ${e.coinciden.map((v) => v.nombre).join(', ') || 'ninguna variable'}.`);
  l.push(`**Difiere en:** ${e.difieren.map((v) => v.nombre).join(', ') || 'ninguna variable'}.`);
  if (e.diagnostico_no_puntua.length > 0) {
    l.push('');
    l.push('**No puntúa (diagnóstico):** ' +
      e.diagnostico_no_puntua.map((d) => `${d.nombre} Tierra ${fmt(d.valor_tierra)} vs objetivo ${fmt(d.valor_objetivo)}`).join('; ') + '.');
  }
  if (e.cerca_de) {
    l.push('');
    l.push(`**Entorno (no puntúa):** tubo de lava ${fmt(e.cerca_de.tubo_lava_km, 1)} km, cráter ${fmt(e.cerca_de.crater_km, 1)} km, salar ${fmt(e.cerca_de.salar_km, 1)} km.`);
  }
  if (e.diferencias_planetarias) {
    const d = e.diferencias_planetarias;
    l.push('');
    l.push('**Lo que ningún dato captura:** ' +
      `gravedad ${fmt(d.gravedad_ms2.tierra)} vs ${fmt(d.gravedad_ms2.objetivo)} m/s²; ` +
      `presión ${fmt(d.presion_superficie_pa.tierra, 0)} vs ${fmt(d.presion_superficie_pa.objetivo, 3)} Pa; ` +
      `atmósfera: ${d.atmosfera.tierra} vs ${d.atmosfera.objetivo}; radiación: ${d.radiacion.tierra} vs ${d.radiacion.objetivo}.`);
  }
  for (const a of e.advertencias) l.push(`\n> ${a}`);
  l.push('');
  l.push(`Método: ${e.metodo.formula}; gamma ${e.metodo.gamma}, lambda ${e.metodo.lambda_contraccion}.`);
  return l.join('\n');
}
