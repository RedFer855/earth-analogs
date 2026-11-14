---
title: "I-39 — Imagen satelital de la Tierra en CesiumJS sin clave: condiciones de Esri y alternativas abiertas"
type: investigacion
status: vigente
date: 2026-11-10
updated: 2026-11-10
summary: "Si las condiciones de Esri permiten usar ArcGIS World Imagery sin clave ni cuenta en una demo web pública y no comercial, qué atribución exige, si se puede guardar para usar sin internet y qué imagen satelital abierta de la Tierra carga CesiumJS sin clave."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-39 — Imagen satelital de la Tierra en CesiumJS sin clave

Consulta sobre las condiciones de uso de ArcGIS World Imagery de Esri sin clave ni cuenta y sobre alternativas de imagen satelital abierta de la Tierra compatibles con CesiumJS (para la Luna y Marte, véase [[I-12-cesium-sin-ion-luna-y-marte]]).

## Prompt

```
I-39 — Imagen satelital de la Tierra sin clave para una demo web pública

IMPORTANTE: Esta es una consulta de datos puntuales sobre condiciones de uso. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Saber si se puede usar ArcGIS World Imagery de Esri sin clave ni cuenta en una demo web pública y no comercial, y qué imagen satelital abierta de la Tierra ofrece una alternativa si no se puede.

CONTEXTO (solo lo que cambia la respuesta)
- Aplicación web estática pública y no comercial con CesiumJS 1.147.
- Interesa determinar la viabilidad de `services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer` sin clave y el uso sin conexión.

YA SABEMOS (no investigar ni repetir)
- La Luna y Marte usan Moon Trek y Mars Trek (dominio público, sin token).
- La cuenta gratuita de Cesium ion dice "Personal and non-commercial use".

PUNTOS A RESPONDER
1. ¿Las condiciones de uso vigentes de Esri permiten usar el servicio World_Imagery sin clave de API ni cuenta en una aplicación web pública y no comercial? Cita el texto exacto y el documento donde aparece.
2. ¿Esri retiró, deprecó o puso fecha de retiro al acceso sin clave de services.arcgisonline.com para los basemaps? Fecha y anuncio oficial.
3. Si hace falta clave o cuenta: qué tipo de cuenta gratuita existe (ArcGIS Location Platform u otra), cuántas teselas de basemap por mes da gratis y si exige tarjeta de crédito. Cifras con fecha de consulta.
4. Qué atribución exige Esri para World Imagery: texto exacto y dónde debe mostrarse.
5. ¿Las condiciones permiten guardar o cachear las teselas para usarlas sin internet durante una demo? Cita el texto.
6. CesiumJS 1.147 trae `ArcGisMapService.defaultAccessToken`. ¿Existe un token por defecto de Cesium o de Esri incluido en CesiumJS, y para qué uso está permitido según su documentación?
7. Imagen satelital global de la Tierra en color real que CesiumJS cargue sin clave ni cuenta: NASA GIBS (por ejemplo, Blue Marble o VIIRS/MODIS en color real) y Sentinel-2 cloudless de EOX. Para cada una: URL del servicio, protocolo (WMTS, TMS o XYZ), resolución, licencia exacta (y si permite uso no comercial público) y si responde con CORS abierto.
8. Licencia de la imagen NaturalEarthII que viene dentro de CesiumJS y su resolución.

ENTREGA
- Una tabla con columnas: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza solo puede ser: Confirmado (la fuente oficial lo dice textualmente) / Probable (fuente secundaria o inferencia directa) / No encontrado.
- Debajo de la tabla, máximo 150 palabras con contradicciones entre fuentes o advertencias.
- Sin introducción, sin resumen ejecutivo, sin conclusiones.

REGLAS
- Usa primero la documentación oficial: esri.com/legal (Master Agreement, Product-Specific Terms), developers.arcgis.com (términos de basemaps y precios), la página del servicio en arcgis.com, cesium.com/learn/cesiumjs/ref-doc, github.com/CesiumGS/cesium (CHANGES.md), nasa-gibs.github.io y earthdata.nasa.gov (GIBS), s2maps.eu (EOX) y naturalearthdata.com.
- Foros y blogs solo si no hay fuente oficial; marca la certeza como Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- Montos en USD con fecha de consulta.
- Español claro, sin lenguaje jurídico innecesario.
```

## Resultado

Fuentes consultadas el 2026-11-10.

| # | Dato | Qué dice la fuente | Fuente `[O]` (consultada 2026-11-10) |
| :-- | :-- | :-- | :-- |
| 1 | Licencia de Esri World Imagery | El ítem del servicio dice "This work is licensed under the Esri Master License Agreement". La exigencia de cuenta o clave aparece en la guía de Esri para CesiumJS (no se abrió) | https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json |
| 2 | Retiro del acceso sin clave | No verificado | - |
| 3 | Cuenta gratuita de Location Platform | No verificado | - |
| 4 | Atribución de World Imagery | "Esri, Vantor, Earthstar Geographics, and the GIS User Community" (`accessInformation` del ítem) | Ítem de arriba |
| 5 | Teselas sin conexión | El ítem dice "This layer is not intended to be used to export tiles for offline" | Ítem de arriba |
| 6 | Token por defecto de CesiumJS | Descrito como "for evaluation purposes only" en `ArcGisMapService`; no se abrió la página | - |
| 7.1-7.2 | NASA GIBS | Datos abiertos con reconocimiento pedido. La tesela responde 200 con `Access-Control-Allow-Origin: *`. Blue Marble 3857 llega hasta el nivel 8 (el 9 da 400) | https://nasa-gibs.github.io/gibs-api-docs/ |
| 7.3 | EOX Sentinel-2 cloudless | 2016 con CC BY 4.0; 2018 en adelante con CC BY-NC-SA 4.0. WMTS gratis para uso no comercial con atribución. La fuente no dice que se puedan descargar teselas para uso sin conexión: el uso sin conexión aparece solo en el contexto de una licencia comercial | https://eox.at/2025/03/sentinel-2-cloudless-2024/ |
| 7.4 | CORS de EOX | Devuelve el origen solicitado en `access-control-allow-origin`. La capa 3857 de 2016 responde hasta el nivel 16 (la resolución nativa, unos 10 m, es el nivel 14) | Prueba con curl |
| 8 | NaturalEarthII | Natural Earth es de dominio público; unos 19,5 km por píxel en CesiumJS (resolución sin medir) | - |

### Alternativas abiertas verificadas

- **Sentinel-2 cloudless 2016 de EOX:** licencia CC BY 4.0 (~10 m nativos), no tiene la cláusula no comercial de las ediciones desde 2018 (CC BY-NC-SA 4.0). Guardar teselas para uso offline no está confirmado en las condiciones abiertas consultadas.
- **NASA GIBS Blue Marble:** ~500 m, datos abiertos con reconocimiento oficial.
- **NaturalEarthII:** incluido en CesiumJS, dominio público, cobertura global de baja resolución (~19,5 km/px).

### Bibliografía

- `[O]` Ítem World Imagery de Esri (JSON de ArcGIS REST) — https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json — consultado 2026-11-10.
- `[O]` NASA GIBS, Data Use Guidance and Acknowledgements — https://nasa-gibs.github.io/gibs-api-docs/ — consultado 2026-11-10.
- `[O]` EOX, Sentinel-2 cloudless 2024 (licencias de 2016 a 2024 y atribución) — https://eox.at/2025/03/sentinel-2-cloudless-2024/ — consultado 2026-11-10.
- `[O]` Teselas de prueba de EOX y GIBS (cabeceras CORS y niveles de zoom), con curl — consultado 2026-11-10.

## Relaciones

- [[I-12-cesium-sin-ion-luna-y-marte]]: lo mismo para la Luna y Marte
