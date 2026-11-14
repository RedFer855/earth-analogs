---
title: "I-29 — Albedo y polvo en el aire comparables entre la Tierra, la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué mapas globales de albedo de la Luna y Marte y qué productos de profundidad óptica de polvo de Marte se pueden comparar con MODIS en la misma definición."
autor: fernando
tipo_investigacion: A
riesgo: bajo
---

# I-29 — Albedo y polvo en el aire comparables entre la Tierra, la Luna y Marte

**Pregunta.** ¿Existe cobertura en la Luna y Marte, y una definición física comparable con MODIS, para dos variables: albedo superficial y profundidad óptica de polvo en el aire?

## Prompt

```
I-29 — Albedo y polvo comparables entre cuerpos

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas el contexto y no hagas recomendaciones.

OBJETIVO
¿Qué mapas globales de albedo de la Luna y Marte y qué productos de profundidad óptica de polvo de Marte usan una definición comparable con los productos de MODIS para la Tierra?

CONTEXTO (solo lo que cambia la respuesta)
- Tierra: albedo de MCD43A3 V061 (cielo blanco, onda corta, 500 m); polvo: profundidad óptica de aerosoles MAIAC (MCD19A2, 550 nm) y DUEXTTAU de MERRA-2.
- La Luna no tiene atmósfera: el polvo solo aplica a Marte. El polo sur lunar es la zona de interés en la Luna.
- MDAD v1.1 es un catálogo de tormentas de polvo de Marte.

PUNTOS A RESPONDER
1. Mapas globales de albedo de la Luna (LROC WAC, Kaguya, Clementine, Diviner bolométrico): tipo de albedo (normal, Lambert, bolométrico, de Bond), banda, resolución, cobertura del polo sur, formato y ruta de descarga.
2. Mapas globales de albedo de Marte (TES bolométrico de Lambert, MOLA reflectancia 1064 nm, OMEGA, MARCI): tipo de albedo, banda, resolución, formato y ruta.
3. Si algún trabajo publicado comparó albedo entre la Tierra y la Luna o Marte, y cómo convirtió entre tipos de albedo.
4. Productos de profundidad óptica de polvo en columna de Marte (TES, THEMIS, MCS, MCD, el compendio de Montabone et al.): longitud de onda de referencia, resolución espacial y temporal, años, formato y ruta.
5. Factor de conversión publicado entre la profundidad óptica en infrarrojo (9 µm) y en visible para Marte.
6. Licencia o condiciones de uso de cada producto.

ENTREGA
- Una tabla con columnas: # | Punto | Respuesta | Fuente oficial (enlace o DOI) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Debajo, máximo 150 palabras con contradicciones o advertencias.
- Sin introducción ni conclusiones.

REGLAS
- Primero fuentes oficiales: PDS (pds.nasa.gov, pds-geosciences.wustl.edu, pds-imaging.jpl.nasa.gov), USGS Astrogeology, LROC (lroc.asu.edu), LMD (www-mars.lmd.jussieu.fr), y artículos revisados.
- Si no encuentras un dato, escribe "No encontrado".
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref; los artículos no se leyeron completos salvo donde se indica.

**Hallazgos de las fuentes**

- **Albedo de la Luna en el polo sur (84°S a 90°S):**

| Producto | Tipo de albedo | Banda | Cobertura del polo sur | Fuente |
| :-- | :-- | :-- | :-- | :-- |
| LROC WAC con Hapke | Albedo normal | 7 bandas, 321–689 nm | Se corta en ±70° | Sato et al. 2014, doi:10.1002/2013JE004580 |
| Kaguya MI | Reflectancia normalizada | 415–1550 nm | Solo ±50° | Haruyama et al. 2008, doi:10.1186/BF03352788 |
| Clementine UVVIS | Albedo normal (i = 30°, e = 0°) | 750 nm y 5 bandas | Hasta 90°S con huecos por sombras | McEwen y Robinson 1997, doi:10.1016/S0273-1177(97)00365-7 |
| Diviner | Bolométrico | 0.35–2.8 µm | No hay mapa de albedo en el PDS | Paige et al. 2009, doi:10.1007/s11214-009-9529-2 |
| **LOLA** | **Albedo normal, fase 0°** | **1064 nm** | **Completa hasta 90°S, también en sombras permanentes** | Lucey et al. 2014, doi:10.1002/2013JE004592; PDS `lro-l-lola-3-rdr-v1` (https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/) |

- **Albedo de Marte:** TES bolométrico de Lambert a 8 ppd (Christensen et al. 2001), MOLA a 1064 nm, OMEGA (Vincendon
  et al. 2015) y MARCI (Bell et al. 2009). Ninguno es BHR como MODIS. Sun et al. 2006 (https://doi.org/10.1364/AO.45.003960) mide la radiancia pasiva de MOLA desde el ruido del receptor, no la reflectancia activa del láser.
- **Punto 3, comparación entre cuerpos:** MODIS MCD43A3 es reflectancia bi-hemisférica (cielo blanco); los mapas de la
  Luna y Marte son albedo normal, reflectancia bidireccional o albedo de Lambert. Pasar de uno a otro pide modelar la
  BRDF con Hapke. No hay fórmula cerrada publicada para pasar el albedo de Lambert de TES a BHR. Para una esfera lambertiana, p = 2/3, q = 3/2 y A = 1; el valor clásico de q para la Luna ronda 0.58.
- **Polvo de Marte, punto 4:** la climatología de Montabone (MY24–MY36, NetCDF diario por año marciano, mapas
  interpolados y en celdas, `dustscenario_MY24_v2-0.nc` a `dustscenario_MY36_v2-5.nc`) en https://www-mars.lmd.jussieu.fr/mars/dust_climatology/, con la profundidad óptica de absorción a 9.3 µm y la visible
  equivalente a 0.67 µm. También TES (Smith 2004), THEMIS (Smith 2009), MCS (Kleinböhl et al. 2009) y la MCD. El registro
  Zenodo 10.5281/zenodo.5517308 no es la climatología: es un reanálisis vertical de MY28–29 de Ruan, Read, Montabone y Lewis (2021).
- **Punto 5, factores:** 9.3 µm en absorción → visible a 0.67 µm, **×2.6** (Montabone et al. 2020,
  https://doi.org/10.1029/2019JE006111); visible/infrarrojo
  en extinción, 2.0 ± 0.2 (Lemmon et al. 2004, https://doi.org/10.1126/science.1104474), hasta ~2.5 en tormentas globales; MCS 21.6 µm → 9.3 µm, ×2.7.
- **Síntesis, albedo:** respecto de la Luna, solo LOLA llega al polo sur, y mide otra magnitud que MODIS (albedo
  normal a 1064 nm frente a BHR de onda corta). Sin modelo de Hapke no son directamente comparables en valor absoluto.
- **Síntesis, polvo:** en Marte existe la climatología de Montabone (×2.6, 0.67 µm) frente a MAIAC (550 nm).

## Preguntas abiertas

- Licencia de la climatología del LMD: no verificada.
- Rango de q ≈ 0.35–0.50 para el regolito: no verificado.

## Relaciones

- [[sensores-luna]], [[sensores-marte]] — sensores planetarios relevantes
