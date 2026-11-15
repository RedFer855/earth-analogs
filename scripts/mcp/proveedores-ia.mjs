// Solicitudes a los proveedores de IA para el puente local. Es la misma tabla que visor/src/datos/iaCliente.ts
// (el visor no puede importar de scripts/); si cambia una, cambiar la otra. La clave llega por parámetro,
// va solo en headers y nunca se guarda.

export const PROVEEDORES_IA = new Set(['gemini', 'openai', 'deepseek', 'anthropic']);

export function solicitudProveedor(proveedor, modelo, clave, sistema, mensajes) {
  if (!PROVEEDORES_IA.has(proveedor)) throw new Error('proveedor desconocido');
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(modelo)) throw new Error('modelo inválido');
  const chat = mensajes.map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto }));
  if (proveedor === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: mensajes.map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'model', parts: [{ text: m.texto }] })),
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      },
    };
  }
  if (proveedor === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: { model: modelo, max_tokens: 1024, system: sistema, messages: chat },
    };
  }
  return {
    url: proveedor === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/v1/chat/completions',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
    body: { model: modelo, messages: [{ role: 'system', content: sistema }, ...chat] },
  };
}

export function textoProveedor(proveedor, j) {
  if (proveedor === 'gemini') return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (proveedor === 'anthropic') return (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return String(j.choices?.[0]?.message?.content ?? '');
}
