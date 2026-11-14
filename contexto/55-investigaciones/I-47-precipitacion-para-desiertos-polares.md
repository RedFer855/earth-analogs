---
title: "I-47 — Precipitación anual para reconocer los desiertos polares del Ártico"
type: investigacion
status: borrador
date: 2026-11-13
updated: 2026-11-13
summary: "Qué climatología de precipitación abierta (preferente NASA) sirve a 1–50 km en el Ártico, qué umbral define un desierto polar y cuánto llueve en los análogos árticos conocidos."
autor: fernando
tipo_investigacion: A
riesgo: bajo
---

# I-47 — Precipitación anual para reconocer los desiertos polares del Ártico

El índice de aridez (AI = P/ETP, Global-AI_PET v3.1; Zomer et al. 2022) falla en el Ártico porque la evapotranspiración potencial (ETP) polar es casi cero. Se estudia la precipitación anual de forma aislada para caracterizar desiertos polares.

## Prompt

```
I-47 — Precipitación anual para desiertos polares del Ártico

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Identificar climatologías de precipitación anual, abiertas y globales, que distingan los desiertos polares del Ártico, y conocer cuánto llueve en análogos árticos de Marte documentados.

CONTEXTO (solo lo que cambia la respuesta)
- Cobertura sobre tierra firme del Ártico, con datasets como MERRA-2 (`M2T1NXFLX` y `M2TMNXFLX`) y otras fuentes abiertas.
- Se priorizan datos abiertos de NASA o de licencia abierta clara.

YA SABEMOS (no investigar ni repetir)
- El índice de aridez P/ETP (Zomer et al. 2022, Global-AI_PET v3.1) falla en el Ártico porque la ETP es casi cero.
- Haughton (75,38 N, -89,67), Axel Heiberg (Expedition Fiord, 79,43 N, -90,77), Adventdalen (78,2 N, 15,8 E) y Bockfjord (79,43 N, 13,32 E) son análogos árticos documentados.

PUNTOS A RESPONDER
1. Qué variable y colección de MERRA-2 da la precipitación total corregida mensual (nombre exacto, unidades, resolución) y si tiene sesgo conocido en el Ártico, con fuente.
2. Otras climatologías globales abiertas con precipitación anual a ≤ 10 km que cubran el Ártico (por ejemplo CHELSA, WorldClim, ERA5-Land, GPCC, IMERG): resolución, periodo, licencia y si cubren por encima de 60° N.
3. Umbral de precipitación anual (y de temperatura del mes más cálido, si lo usan) con que la literatura define "desierto polar" o "polar desert"; fuente.
4. Precipitación anual medida o reanalizada en Haughton, Expedition Fiord, Adventdalen (estación de Svalbard Lufthavn) y Bockfjord, con fuente y periodo.
5. Si existe un mapa global publicado de "polar deserts" o "polar semi-deserts" (por ejemplo CAVM, Circumpolar Arctic Vegetation Map, clases de barrens), con resolución y licencia.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial: GES DISC (MERRA-2 File Specification), CHELSA, WorldClim, Copernicus CDS, NOAA, artículos revisados por pares.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- Precipitación en mm/año, indicando el periodo de cada climatología.
```

## Resultado

Sin resultado todavía.

## Relaciones

- [[sensores-tierra]] — fuente del índice de aridez
