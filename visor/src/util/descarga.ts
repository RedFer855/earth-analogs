/** Baja un texto como archivo desde el navegador (sin servidor). */
export function descargarTexto(nombre: string, contenido: string, tipo = 'application/geo+json'): void {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}
