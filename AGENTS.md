# AGENTS.md — Earth analogs · Moon · Mars (NASA Space Apps 2026)

> Punto de entrada único para cualquier agente de IA (Claude Code, Antigravity, opencode, Codex, Gemini, Copilot…) y
> para las personas del equipo. Este archivo es el contrato. El conocimiento vive en [`contexto/`](contexto/) y se
> consulta **por índice, no de corrido**.

## Qué es el proyecto

Equipo **J4Ks** (Tegucigalpa) en el reto *Identify Earth Locations that Analog the Permanent Moon Base Locations and
Mars* de NASA Space Apps 2026 (14 y 15 de noviembre). Buscamos zonas de la Tierra análogas a las regiones candidatas a
base permanente en la Luna y a sitios de Marte, comparando varias variables a la vez (pendiente, rugosidad,
temperatura, aridez, permafrost, viento, polvo, mineralogía) y diciendo **en qué coinciden y en qué difieren**.

Estamos en la **fase de creación**. Las investigaciones están en `contexto/55-investigaciones/`,
`50-referencia/` y `10-reto/`. Todo lo demás se crea aquí.

## Reglas de oro

1. **Datos abiertos y reales:** toda comparación sale de datasets públicos (NASA, USGS, ESA…) con nombre, versión y URL.
2. **Analogía por procesos físicos, no por parecido visual.** Cada análogo dice en qué coincide y en qué difiere
   (gravedad, atmósfera, presión y escala incluidas).
3. **Preprocesar offline, servir ligero:** los rasters de GB se procesan en la PC; la web solo carga archivos
   derivados de pocos MB. Ningún archivo crudo entra a git.
4. **Seguridad:** nunca secretos en git. Van en `.env` (ignorado). Si gitleaks marca algo real: se rota y se quita.
5. **Licencias:** cada dataset y librería lleva su licencia anotada en `contexto/50-referencia/` antes de usarse.
6. **Flujo de git:** GitHub Flow sobre `main`, PR con *squash*, check `CI completo` en verde, ~500 líneas de código por
   PR (tope 1000). Ramas `tipo/descripcion-corta`; Conventional Commits.
7. **Revisión de contenido:** antes de cada commit y PR corre la revisión de contenido del equipo (ganchos instalados
   en cada PC). Si no pasa, se reescribe; no hay excepciones.
8. **Auditoría:** cada paso del ETL se corre con `audit/audit.py` y su registro se commitea al cerrar el paso.
9. **Evidencia:** toda afirmación fuerte lleva fuente con URL y fecha. Si no se verificó, escribir "no verificado".
10. **Lo que se decide en un chat no existe** hasta que está en `contexto/` como ADR o nota.

## Verificación

```bash
node scripts/contexto/build-index.js   # regenera contexto/INDEX.md e INDEX-*.md
node scripts/contexto/verificar.js     # 0 errores
node --test scripts/contexto/lib.test.js
python -I -m unittest discover -s audit -p "test_*.py"
node audit/verificar.mjs
```

## Cómo entrar en frío

1. Este archivo y `contexto/10-reto/` (lo que pide el reto).
2. [`contexto/INDEX.md`](contexto/INDEX.md): una línea por nota. Léelo entero.
3. Elige de 3 a 6 notas y abre solo esas. Si el índice no alcanza: `grep -ril "término" contexto/`.
4. Plan de datos: [`docs/etl-plan.md`](docs/etl-plan.md). En Claude Code, el subagente `lector-contexto` localiza notas.

| Vas a… | Empieza por |
| :-- | :-- |
| Entender el reto | `contexto/10-reto/` |
| Usar un dataset | `contexto/50-referencia/` (revisa `vence:`) y `30-datos/` |
| Agregar un sitio | `contexto/32-sitios/` con `plantilla-sitio.md` |
| Entender por qué algo es así | `contexto/45-decisiones/` |
| Consultar una investigación | `contexto/55-investigaciones/` |
| Preparar el pitch o el video | `contexto/85-entrega/` |

## Al terminar: documenta

| Hiciste… | Va en… |
| :-- | :-- |
| Una sesión de trabajo | Nota en `contexto/70-bitacora/AAAA-MM/` (`AAAA-MM-DD-autor-titulo.md`) |
| Una decisión con alternativas descartadas | ADR en `contexto/45-decisiones/` |
| Algo roto que no arreglaste | Ítem `P-NNN` en `contexto/80-deuda/abierta.md` |
| Aprendiste un hecho externo | Nota en `contexto/50-referencia/` con `consultado:` y `vence:` |

Usa las plantillas de `contexto/_plantillas/` (protocolo en su `LEEME.md`). Toda nota lleva `autor` (alias de
`contexto/.control/equipo.json`) y las sesiones además `agente`.

## Redacción

Docs públicos (README, `docs/`) en inglés; notas de `contexto/` y código pueden ir en español. Directo, sin adornos.
Fechas absolutas (AAAA-MM-DD).

## Mapa de archivos de control

| Archivo | Qué es |
| :-- | :-- |
| `AGENTS.md` | Contrato. Fuente única de reglas para agentes. Tope 8 KB. |
| `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` | Apuntadores a este archivo. |
| `contexto/INDEX*.md` | Índices generados. No editar a mano. |
| `.github/workflows/` | `ci.yml` (check `CI completo`, gitleaks, auditoría) y `contexto.yml`. |
| `audit/` | Registro de auditoría del ETL. |
