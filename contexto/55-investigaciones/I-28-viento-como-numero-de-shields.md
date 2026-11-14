---
title: "I-28 — Viento como fracción del tiempo sobre el umbral de arrastre en la Tierra y Marte"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué umbral de arrastre de arena (de inicio o de impacto) se usa para Marte y la Tierra, cómo se calcula la velocidad de fricción con MERRA-2 y con la Mars Climate Database, y cómo se ha comparado entre los dos planetas."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-28 — Viento como fracción del tiempo sobre el umbral de arrastre en la Tierra y Marte

**Pregunta.** ¿Qué umbral se usa para el número de Shields (fracción del tiempo sobre el umbral de arrastre) en la Tierra y Marte, y cómo se obtiene la velocidad de fricción de MERRA-2 y de la Mars Climate Database?

## Prompt

```
I-28 — Umbral de arrastre de arena en la Tierra y Marte

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía de física eólica, no repitas el contexto y no hagas recomendaciones.

OBJETIVO
¿Con qué umbral y con qué datos de modelos atmosféricos se calcula la fracción del tiempo en que el viento supera el umbral de arrastre de arena, de forma comparable entre la Tierra y Marte?

CONTEXTO (solo lo que cambia la respuesta)
- Tierra: MERRA-2 (M2T1NXSLV horario, M2TMNXSLV mensual, 0.5° × 0.625°). Marte: Mars Climate Database (MCD).
- No se comparan m/s entre planetas: el aire de Marte es ~100 veces menos denso. Se busca una magnitud adimensional o una fracción de tiempo.
- El número de Shields relaciona el esfuerzo del viento con el peso del grano. El promedio del viento borra las ráfagas, por lo que se usa la fracción del tiempo sobre el umbral.

PUNTOS A RESPONDER
1. Umbral de inicio (fluido) y umbral de impacto (dinámico) de velocidad de fricción u*t para arena de ~100-200 µm en Marte y en la Tierra, con fuente y ecuación usada (Shao y Lu 2000, Kok 2010 u otra).
2. Cuál de los dos umbrales usan los estudios de actividad de dunas actuales en Marte, y por qué.
3. Variables de MERRA-2 que dan la velocidad de fricción o el esfuerzo superficial (nombre exacto, colección, unidad) y, si no existe, cómo se calcula desde el viento a 10 m o 2 m.
4. Variable equivalente en la Mars Climate Database (nombre, unidad, resolución temporal y espacial) y cómo se accede (web, versión, licencia).
5. Trabajos publicados que comparan la frecuencia de transporte eólico entre la Tierra y Marte con una magnitud adimensional o una fracción de tiempo: qué magnitud usaron.
6. Si la resolución de ~50 km (MERRA-2) y de ~ cientos de km (MCD) subestima la fracción sobre el umbral, y en cuánto, según la literatura.

ENTREGA
- Una tabla con columnas: # | Punto | Respuesta | Fuente oficial (enlace o DOI) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Debajo, máximo 150 palabras con contradicciones o advertencias.
- Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial (GMAO MERRA-2 File Specification, gmao.gsfc.nasa.gov; www-mars.lmd.jussieu.fr para la MCD) y artículos revisados (JGR Planets, Icarus, Aeolian Research, Reports on Progress in Physics).
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref; no todos los artículos se leyeron completos.

**Hallazgos de las fuentes**

- **Punto 1, umbral de inicio:** Shao y Lu (2000), u*ft = A_N · √( (ρp − ρa)/ρa · g · Dp + γ/(ρa · Dp) ), con
  A_N = √0.0123 ≈ 0.111 y γ = 2.9 × 10⁻⁴ N/m (https://doi.org/10.1029/2000JD900304). Evaluada con esa ecuación: Tierra 0.24 m/s (100 µm) y 0.26 m/s (200 µm); Marte
  1.57–1.81 m/s (100 µm, ρa 0.015–0.020 kg/m³, basalto). **Umbral de impacto:** en la Tierra u*it/u*ft ≈ 0.80–0.82
  (Bagnold 1937); en Marte ~0.10–0.30, un orden de magnitud menos (Kok 2010).
- **Punto 2, qué umbral usan los estudios de dunas en Marte:** un umbral efectivo de τ = 0.01 ± 0.0015 Pa
  (u* ≈ 0.71–0.82 m/s), calibrado con la migración observada en Nili Patera (Ayoub et al. 2014). Está cerca del de
  impacto: con el de inicio, los modelos casi no predicen transporte, y HiRISE sí lo ve. Bridges et al. 2017 muestran
  que ese umbral en MarsWRF da mal la dirección en el cráter Gale.
- **Punto 3, MERRA-2:** la colección es `M2T1NXFLX` (horaria) y `M2TMNXFLX` (mensual). Variables:
  USTAR (m s⁻¹), TAUX y TAUY (N m⁻²), Z0M (m), RHOA (kg m⁻³), según la File Specification
  (https://gmao.gsfc.nasa.gov/pubs/docs/Bosilovich785.pdf). También trae SPEEDMAX (viento máximo en la hora). Desde
  el viento a 10 m: u* = κ · U(z) / ln((z − DISPH)/z0), con κ = 0.40.
- **Punto 4, MCD:** esfuerzo superficial ("Surface wind stress", Pa) con `call_mcd`; u* = √(τ/ρ). Malla del GCM de
  5.625° × 3.75° (~330 × 220 km), 12 salidas por día y 12 meses marcianos; versión 6.1 (manual) y 6.2 (web); gratis
  bajo pedido, citando Forget et al. 1999 y Millour et al. 2018.
- **Punto 5, comparaciones Tierra-Marte:** Kok 2010 (fracción del tiempo con saltación activa, con distribución de
  Weibull del viento e histéresis), Martin y Kok 2018 (actividad de saltación y u*it/u*ft), Claudin y Andreotti 2006
  (fracción sobre el umbral y número de Shields), Gunn y Jerolmack 2022 (razón sobre el umbral y número de Shields).
- **Punto 6, resolución:** las dos mallas subestiman. En Marte, con 0.02 Pa la MCD da 6 casos sobre el umbral (~2 %)
  y las observaciones orbitales 124 (~33 %); la MCD subestima el viento en el 76 % (estéreo) al 96 % (franjas de color)
  de los casos, por ~3 a ~10 m/s (Bickel et al. 2025, https://doi.org/10.1126/sciadv.adw5170; velocidades a 10 m, derivadas de remolinos de polvo). En la Tierra no hay un porcentaje para la fracción de tiempo a
  50 km; Leung et al. 2023 muestran que al engrosar la malla u* cae bajo el umbral en zonas marginales.

## Preguntas abiertas

- La parametrización de u*it de Kok 2010b (GRL) con los valores 0.57 / 0.13 m/s no se localizó: arXiv:1001.4840 (https://arxiv.org/abs/1001.4840) es otro trabajo de Kok ("Analytical calculation…").
- El manual de la MCD (variable `extvar(57)`, malla, licencia) y Michel 2018 (35 %) no se abrieron.
- Un factor de 2 a 3 atribuido a Ridley et al. 2013 queda sin fuente: el DOI 10.5194/acp-13-8879-2013 corresponde a Lee et al., sobre núcleos de condensación.
- Falta comparar el umbral efectivo calibrado en Marte (τ ≈ 0.01 Pa) con los umbrales en MERRA-2, y el sesgo de escala de la MCD frente a MERRA-2 para la fracción de tiempo.

## Fuentes

- <https://doi.org/10.1029/2000JD900304>
- <https://gmao.gsfc.nasa.gov/pubs/docs/Bosilovich785.pdf>
- <https://doi.org/10.1126/sciadv.adw5170>
- <https://arxiv.org/abs/1001.4840>
- <https://doi.org/10.5194/acp-13-8879-2013>


## Relaciones

- [[I-11-sesgo-por-escala-de-cada-variable]] — por qué la fracción de tiempo y no la media
- [[I-18-procesos-como-variables]] — los procesos activos
