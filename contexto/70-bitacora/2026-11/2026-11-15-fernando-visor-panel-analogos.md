---
title: "Sesión 2026-11-15 — Panel de análogos del visor: solidez, análogos documentados y ficha con minerales"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Explicación del código del panel nuevo del visor: pestañas, solidez del ajuste con su rango, catálogo de análogos documentados, ficha con minerales y la normalización de estabilidad.json."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/visor-estilo-privado
scope:
  - visor/src/panel/panelAnalogos.ts
  - visor/src/panel/analogos.css
  - visor/src/datos/solidez.ts
  - visor/src/datos/ficha.ts
  - visor/src/datos/analogos.ts
  - visor/src/datos/contrato.ts
  - visor/src/capas/analogos.ts
  - visor/src/capas/candidatos.ts
  - visor/src/main.ts
  - motor/pipeline/src/salida.rs
  - etl/sitios/analogos-tierra.json
  - etl/e21_capas_web.py
---

# Sesión 2026-11-15 — Panel de análogos del visor

## Qué hace cada archivo

- `visor/src/panel/panelAnalogos.ts` → un panel con tres pestañas. **Mapa**: elige Luna o Marte, un sitio objetivo,
  la lista de lugares (análogos documentados y candidatos del motor), el Top 3 multivariable, el filtro por nivel de
  solidez y la ficha del lugar elegido. **Buscar**: el buscador por capas de ~50 km que ya existía. **Chat**: el
  asistente de [[ADR-012-mcp-y-asistente-con-clave-propia]]. Todo el HTML se arma con `escaparHtml`.
- `visor/src/panel/analogos.css` → estilos del panel: pestañas, chips, lista, tarjetas, barras de desviación,
  regla de solidez y Top 3.
- `visor/src/datos/solidez.ts` → `puntuar` calcula el índice de 0 a 100 con cinco componentes (ajuste 40,
  discriminación 20, robustez 20, calidad 10, cobertura 10), su rango y su nivel (alta desde 65, media desde 40).
  `wilson` da el intervalo de la robustez. `leerVariable` dice si una variable coincide, en qué dirección difiere y a
  cuántas veces la tolerancia. `topMultivariable` agrupa los candidatos de todos los objetivos por celda de 1° y deja
  los lugares que salen en más de un objetivo.
- `visor/src/datos/ficha.ts` → valores de `capas7` en un punto, minerales (ASTER, EMIT) y suelo con su percentil frente
  a la Tierra, y el nombre del lugar con Photon (tiempo límite de 8 s).
- `visor/src/datos/analogos.ts` y `visor/src/capas/analogos.ts` → leen `datos/analogos-tierra.json` y dibujan cada
  análogo como un punto azul con su círculo de escala.
- `visor/src/datos/healpix.ts` → se agregó `ang2pixNested` (con latitud autálica, igual que `etl/comun.py`) y
  `buscarIpix`, para ubicar un punto en la tabla de `capas7`.
- `visor/src/datos/contrato.ts` → `normalizarEstabilidad` convierte el `estabilidad.json` que escribe el motor
  (`escenarios` y `robustez` por sitio) a la forma `objetivos[sitio] = { n_escenarios, celdas }` que lee el visor.
- `visor/src/capas/candidatos.ts` → `colorear` cambia el color de las celdas (por nota o por solidez) sin recrear la
  geometría.
- `visor/src/main.ts` → conecta el panel con las capas, el asistente y los datos.
- `motor/pipeline/src/salida.rs` → si la carpeta de sitios tiene `analogos-tierra.json`, el motor marca cada
  candidato con `analogo_conocido` cuando cae a menos de `radio_documentado_km` de un análogo.
- `etl/sitios/analogos-tierra.json` → catálogo de análogos de la investigación `[[I-03-analogos-terrestres-documentados]]`.
  Las coordenadas son aproximadas y el archivo lo dice (`coordenadas_verificadas: false`).
- `etl/e21_capas_web.py` → agrega a las capas de nivel 7 las columnas de ASTER, EMIT, arcilla, limo y arena.
- `scripts/visor/publicar-datos.mjs` → copia también `analogos-tierra.json` y `estabilidad.json`.

## Cómo se calcula la solidez con los datos publicados

- Ajuste: 0,5 por la fracción de variables dentro de la tolerancia más 0,5 por la cercanía media.
- Discriminación: fracción de variables cuya tolerancia no pasa de 5 veces la escala de la Tierra.
- Robustez: apariciones sobre escenarios de `estabilidad.json`; el rango usa Wilson al 95 %.
- Calidad del perfil: no se publica; queda en 0,5 y su incertidumbre (0,1 a 1) entra al rango.
- Cobertura: variables con dato sobre variables del perfil.
- Topes: ajuste menor que 0,6, discriminación menor que 0,5 o robustez (Wilson inferior) menor que 0,7 limitan el nivel.
  El puntaje mostrado respeta el nivel; el rango no se recorta.

## Verificación

- `npm --prefix visor run prueba` (nuevo `solidez.prueba.ts`: puntaje, topes, Wilson, lectura de variables, Top,
  `ang2pix`, catálogo y normalización de estabilidad) y `npm --prefix visor run build`.
- `cargo test --workspace` (nueva prueba del catálogo de análogos) y `pixi run pruebas` en `etl/`.
- `node scripts/contexto/verificar.js`.

## Relaciones

- `[[ADR-011-visor-web-sobre-el-contrato]]` — visor que se amplía
- `[[ADR-012-mcp-y-asistente-con-clave-propia]]` — asistente de la pestaña Chat
- `[[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]]` — motor que marca `analogo_conocido`
