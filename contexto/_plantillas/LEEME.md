# Protocolo de escritura en `contexto/`

Léelo cuando vayas a **escribir** en `contexto/`. Para **leer**, entra por [`../INDEX.md`](../INDEX.md).
Funciona con solo leer, escribir y buscar en markdown: no requiere herramientas especiales ni Obsidian.
Sale de `E-01-estandar-documentacion` (en `45-decisiones/`), copiado de FOE 360 y adaptado al reto.

Dónde se verifica cada cosa y cuándo se cierra un `P-NNN`: [`AGENTS.md`](../../AGENTS.md), regla de oro 9.

## 1. Qué va en cada carpeta

| Carpeta | Va aquí | No va aquí |
| :-- | :-- | :-- |
| `00-mapa` | Vistas para humanos (tableros de Obsidian) | Contenido que solo exista ahí |
| `10-reto` | Enunciado del reto, calendario, criterios del jurado, reglas de Space Apps | Decisiones técnicas |
| `20-casos-de-uso` | `CU-NN`: qué hace con el visor el jurado, un científico o un ingeniero de misión | Diseño de pantallas |
| `25-diagramas/` | `prompt_*.md` (fuente) y sus salidas | Diagramas sin prompt |
| `30-datos` | Variables, vector de parámetros, normalización y formato de las tablas ligeras | Los datos crudos (van en `datos/`, ignorado) |
| `32-sitios` | `SL-NN` sitios de base en Luna y Marte y `ST-NN` análogos terrestres, con `plantilla-sitio.md` | Opiniones sin datos |
| `35-modulos/M-NN-nombre/` | Ficha del módulo (`M-NN-ficha.md`) y especificación de cada submódulo (`SM-NN.N-nombre.md`), según E-02 | Notas de sesión; el detalle de otro módulo |
| `40-arquitectura` | Estado vivo: pipeline offline, motor Rust/Wasm, visor 3D, asistente, entorno | Historia de cómo se llegó ahí |
| `45-decisiones` | `ADR-NNN`, estándares `E-NN` y decisiones pendientes `DP-NN` | Cambios sin decisión de fondo |
| `50-referencia` | Hechos externos con fecha: misiones, sensores, portales, APIs, licencias, reglas del reto | Lógica del proyecto |
| `55-investigaciones` | `I-NN` (solo `.md`) y sus prompts | Los `.docx` de entrega (se generan) |
| `60-qa` | Validación contra análogos conocidos, pruebas del motor, auditorías | Notas de sesión |
| `65-seguridad` | Hallazgos `S-NNN`: secretos, licencias, dependencias | Secretos (nunca en el repo) |
| `70-bitacora/AAAA-MM/` | Notas de sesión con fecha | Conocimiento atemporal |
| `80-deuda` | `abierta.md` con ítems `P-NNN`; `resuelta-AAAA.md` | Archivos sueltos por ítem |
| `85-entrega` | Pitch, guion del video, demo y lo que pide el formulario de Space Apps | Borradores sin fecha |

Regla rápida: ¿hiciste algo hoy? → sesión. ¿Reveló una decisión de fondo? → además un ADR. ¿Dejaste algo roto? → `P-NNN`.
¿Aprendiste un hecho externo? → referencia con `vence:`. ¿Evaluaste un lugar? → ficha `SL-NN` o `ST-NN`.

## 2. Frontmatter

Obligatorio en toda nota: `title`, `type`, `status`, `date`, `updated`, `summary`, `autor`.

- `autor`: el **alias de la persona** dueña de la sesión, registrado en `contexto/.control/equipo.json`.
  Un agente lo averigua así: `gh api user --jq .login` (o `git config user.name`) y busca ese usuario de GitHub
  en `equipo.json`. Si no lo encuentra, pregunta. Al sumar a alguien del equipo J4Ks, se agrega su alias ahí.
- `agente`: la **herramienta** que escribió la nota: `claude-code`, `codex`, `antigravity`, `gemini-cli`,
  `copilot`, `cursor`, `opencode`, `hermes` o `humano`. Obligatorio en sesiones; opcional en el resto.
- `modelo`: opcional (por ejemplo `opus-5.5`).

- `type`: `sesion`, `resumen`, `adr`, `decision-pendiente`, `caso-uso`, `regla`, `diagrama`, `arquitectura`,
  `modulo`, `submodulo`, `datos`, `referencia`, `investigacion`, `qa`, `seguridad`, `deuda`, `producto`, `estandar`, `mapa`,
  `sitio` (fichas de `32-sitios/`) y `entrega` (`85-entrega/`).
- Submódulos (E-02) además: `modulo`, `responsable`, `estado_sm` (`propuesto`, `en-preguntas`, `aprobado`,
  `en-curso`, `en-auditoria`, `cerrado`), `depende_de` (IDs `SM-NN.N`) y `cambia_contrato`
  (+ `aprobado_contrato_por` si es `true`).
- `status`: `borrador`, `vigente`, `reemplazado`, `archivado`.
- Fechas absolutas `AAAA-MM-DD`. `date` es cuando nació; `updated`, el último cambio de contenido.
- `summary`: una frase declarativa. Es la línea que publica el índice: escríbela bien una vez.

Trazabilidad (cuando aplique):

| Campo | Qué pone | Ejemplo |
| :-- | :-- | :-- |
| `scope` | Rutas del repo que la nota describe (llevan `/`) | `motor/src/similitud.rs` |
| `symbols` | Structs, funciones, componentes | `evaluate_quadrant_potential` |
| `cu` | Casos de uso | `[CU-01]` |
| `datasets` | Datasets que usa | `[MOLA, SRTM]` |
| `modulo` | Módulo de construcción al que pertenece (E-02) | `M-01` |
| `supersedes` | Notas que esta reemplaza | `[ADR-002]` |

Conocimiento que caduca (resoluciones, versiones de datasets, límites de APIs, reglas del reto): `consultado`, `vence`
y `fuentes` con `url`, `nivel` (`O`, `P` o `B`) y `fecha`. El verificador avisa cuando `vence` ya pasó.

Un `scope` que no existe es error en una nota `vigente` y aviso en un `borrador` (para lo que todavía no se construyó).

## 3. Nombres e identificadores

- Archivos y carpetas en minúsculas, con guiones, sin acentos ni espacios. El título con acentos va en `title:`.
- Sesiones: `70-bitacora/AAAA-MM/AAAA-MM-DD-autor-titulo-corto.md`, una por sesión y autor. El autor en el
  nombre evita choques cuando dos personas documentan el mismo día.
- Documentos con identificador: el ID va al inicio del nombre (`ADR-001-estructura-del-contexto.md`).

| Prefijo | Qué | Formato |
| :-- | :-- | :-- |
| `ADR` | Decisión con alternativas | `ADR-NNN` |
| `E` | Estándar | `E-NN` |
| `I` | Investigación | `I-NN` |
| `CU` | Caso de uso | `CU-NN` |
| `DP` | Decisión pendiente | `DP-NN` |
| `M` | Módulo (ficha `M-NN-ficha.md`) | `M-NN` |
| `SM` | Submódulo | `SM-NN.N` |
| `P` | Deuda técnica (título `### P-NNN` dentro de `80-deuda/`) | `P-NNN` |
| `S` | Hallazgo o incidente de seguridad (`65-seguridad/S-NNN-nombre.md`) | `S-NNN` |
| `SL` | Sitio de base en la Luna o en Marte (`32-sitios/SL-NN-nombre.md`) | `SL-NN` |
| `ST` | Sitio análogo terrestre (`32-sitios/ST-NN-nombre.md`) | `ST-NN` |

Los identificadores son únicos en todo el repositorio; el verificador lo comprueba.

## 4. Antes de crear: busca

Varios agentes y personas escriben sin coordinarse; la duplicación es el riesgo principal.

1. Busca el tema en `INDEX.md` y, si la carpeta va resumida, en su `INDEX-<carpeta>.md`.
2. Si existe una nota del tema, actualízala y sube `updated:`.
3. Si dudas entre dos nombres, usa el que ya existe.

## 5. Trabajo en paralelo

- Las sesiones son append-only: cada uno crea la suya y no edita la de otro.
- Archivos compartidos (`80-deuda/abierta.md`, notas de `40-arquitectura`): cambios chicos y localizados; un `P-NNN`
  nuevo al final de su sección.
- `INDEX.md` no se resuelve a mano en un conflicto: se regenera.
- La documentación va en el mismo PR que el código que describe.

## 6. Enlaces

- Enlaza con `[[nombre-del-archivo]]` (sin `.md`). Un enlace a una nota que no existe es un aviso, no un error.
- Toda nota cierra con `## Relaciones`.

## 7. Ciclo de vida: que la basura no se acumule

Lo que un agente carga al arrancar tiene que crecer con lo vigente, no con la historia.

| Situación | Qué hacer |
| :-- | :-- |
| Una nota nueva reemplaza a otra | En la vieja: `status: reemplazado` y `reemplazado_por: nombre-de-la-nueva`. Sale del índice sola |
| Algo dejó de aplicar pero conviene recordarlo (un ADR superado) | `status: archivado`. Sale del índice, queda en el repo |
| Un duplicado, un borrador abandonado, una nota sin valor | **Se borra.** Git guarda la historia; no hace falta archivarla |
| Cierra el mes | Un agente escribe `70-bitacora/AAAA-MM/AAAA-MM-resumen.md` con `plantilla-resumen-mes.md` (10 a 15 líneas) |
| El verificador avisa "su scope cambió después de updated" | Revisar la nota contra el código; si sigue bien, subir `updated` |
| El verificador avisa "ninguna nota la enlaza" | Enlazarla desde donde corresponda, o borrarla si sobra |

El índice nunca lista notas `reemplazado` o `archivado`; solo dice cuántas hay por carpeta.

## 8. Después de escribir

```bash
node scripts/contexto/build-index.js
node scripts/contexto/verificar.js
```
