"""Cola tipo make para ejecutar pasos del ETL en orden de dependencias.

Corre solo los pasos desactualizados: los ligeros en paralelo y los pesados limitados,
cada uno envuelto en audit/audit.py y con bitácora en $RUN/<id>.log. Solo biblioteca estándar.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from collections import deque
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Sequence, TextIO

ETL_DIR = Path(__file__).resolve().parent
RAIZ = ETL_DIR.parent
AUDIT_PY = RAIZ / "audit" / "audit.py"
DEPS_COMUNES = (ETL_DIR / "comun.py", ETL_DIR / "comun_tabla.py")


@dataclass(frozen=True)
class Paso:
    id: str
    script: str
    args: tuple[str, ...]
    salidas: tuple[str, ...]
    depende_de: tuple[str, ...]
    pesado: bool = False
    paso_audit: str | None = None

    @property
    def id_audit(self) -> str:
        return self.paso_audit or self.id[:4]


def _cols(*nombres: str, resumen: str) -> tuple[str, ...]:
    rutas = [f"columns/{n}.{ext}" for n in nombres for ext in ("f32", "json")]
    rutas.append(resumen)
    return tuple(rutas)


PASOS: tuple[Paso, ...] = (
    Paso(
        id="E-01",
        script="e01_malla.py",
        args=(),
        salidas=("grid/ipix.u32", "grid/lat.f32", "grid/lon.f32", "grid/grid.json"),
        depende_de=(),
        pesado=False,
    ),
    Paso(
        id="E-02",
        script="e02_fuentes.py",
        args=(),
        salidas=("fuentes/e02.json",),
        depende_de=(),
        pesado=False,
    ),
    Paso(
        id="E-03",
        script="e03_extras.py",
        args=(),
        salidas=(
            "terreno/gsw_occurrence.vrt",
            "terreno/e03.json",
            *_cols(
                "slope_mean_deg",
                "slope_std_deg",
                "terreno_n_px",
                "slope_p90_deg",
                "slope_p99_deg",
                "slope_frac_gt15",
                "elev_mean_m",
                "elev_std_m",
                "relieve_m",
                "rug_rms_mean_m",
                "rug_rms_p90_m",
                "relieve_mean_m",
                "relieve_p90_m",
                "frac_valida",
                resumen="columns/e03_extras.json",
            ),
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=True,
    ),
    Paso(
        id="E-04",
        script="e04_temperatura.py",
        args=(),
        salidas=_cols(
            "lst_dia_k",
            "lst_noche_k",
            "rango_diurno_k",
            "amp_anual_k",
            "lst_media_k",
            "lst_dia_max_k",
            "lst_noche_min_k",
            "dtr_max_k",
            "lst_n_meses",
            resumen="columns/e04.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=True,
    ),
    Paso(
        id="E-05",
        script="e05_ndvi.py",
        args=(),
        salidas=_cols(
            "ndvi_max",
            "ndvi_n_periodos",
            "ndvi_max_clim",
            "ndvi_media",
            resumen="columns/e05.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=True,
    ),
    Paso(
        id="E-06",
        script="e06_aridez.py",
        args=(),
        salidas=_cols(
            "aridez_ai",
            "et0_mm_anio",
            resumen="columns/e06.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=False,
    ),
    Paso(
        id="E-07",
        script="e07_permafrost.py",
        args=(),
        salidas=_cols(
            "magt_c",
            "permafrost_prob",
            "hielo_suelo_gam",
            "hielo_suelo_gbm",
            resumen="columns/e07.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=True,
    ),
    Paso(
        id="E-08",
        script="e08_viento_polvo.py",
        args=(),
        salidas=_cols(
            "ustar_media_ms",
            "ustar_p95_ms",
            "viento_tau_media_pa",
            "viento_frac_tau_gt_0p02",
            "viento_frac_tau_gt_0p05",
            "viento_frac_tau_gt_0p10",
            "viento_frac_tau_gt_0p20",
            "duem_kg_m2_s",
            "polvo_frec_dod02_pct",
            "polvo_frec_dod05_pct",
            "polvo_frec_dod1_pct",
            "polvo_n_meses",
            resumen="columns/e08.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=False,
    ),
    Paso(
        id="E-09",
        script="e09_material.py",
        args=(),
        salidas=_cols(
            "aster_emis_media",
            "aster_qi",
            "aster_mi",
            "aster_ci",
            "glim_clase",
            "emit_calcite",
            "emit_chlorite",
            "emit_dolomite",
            "emit_goethite",
            "emit_gypsum",
            "emit_hematite",
            "emit_illite_muscovite",
            "emit_kaolinite",
            "emit_montmorillonite",
            "emit_vermiculite",
            "emit_quartz_feldspar",
            "arcilla_gkg",
            "limo_gkg",
            "suelo_fino_pct",
            resumen="columns/e09.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=False,
    ),
    Paso(
        id="E-10",
        script="e10_agua.py",
        args=(),
        salidas=_cols(
            "frac_tierra",
            "frac_oceano",
            "frac_lago",
            "frac_rio",
            "frac_efimero",
            "glwd_clase",
            "cielo_visible",
            resumen="columns/e10.json",
        ),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
            "E-03",  # exige terreno/gsw_occurrence.vrt generado por E-03
        ),
        pesado=False,
    ),
    Paso(
        id="E-11",
        script="e11_luna.py",
        args=(),
        salidas=("objetivos/objetivos_luna.json",),
        depende_de=(),
        pesado=False,
    ),
    Paso(
        id="E-12",
        script="e12_marte.py",
        args=(),
        salidas=("objetivos/objetivos_marte.json",),
        depende_de=(),
        pesado=False,
    ),
    Paso(
        id="E-15",
        script="e15_capas_30m.py",
        args=(),
        salidas=("columns/e15.json",),
        depende_de=(
            "E-01",  # lee la malla HEALPix con cargar_malla(run)
        ),
        pesado=True,
    ),
    Paso(
        id="E-13",
        script="e13_manifiesto.py",
        args=(),
        salidas=("manifest.json",),
        depende_de=(
            "E-01",  # lee grid/grid.json y la malla con cargar_malla(run)
            "E-02",  # incluye fuentes/e02.json en el manifiesto
            "E-03",  # verifica las columnas de terreno y relee slope_mean_deg
            "E-04",  # verifica las columnas de temperatura en columns/
            "E-05",  # verifica las columnas de NDVI y relee ndvi_max
            "E-06",  # verifica las columnas de aridez y relee aridez_ai
            "E-07",  # verifica las columnas de permafrost y hielo en columns/
            "E-08",  # verifica las columnas de viento y polvo en columns/
            "E-09",  # verifica las columnas de material en columns/
            "E-10",  # verifica las columnas de agua y usa frac_tierra en la relectura
            "E-11",  # incluye objetivos/objetivos_luna.json en el manifiesto
            "E-12",  # incluye objetivos/objetivos_marte.json en el manifiesto
            "E-15",  # verifica las columnas de 30 m en columns/
        ),
        pesado=False,
    ),
    Paso(
        id="E-20",
        script="e20_perfiles.py",
        args=(),
        salidas=("perfiles.json",),
        depende_de=(
            "E-13",  # toma n_celdas y los percentiles de terreno del manifiesto
        ),
        pesado=False,
    ),
)


def construir_comando_audit(
    paso: Paso,
    run_dir: Path,
    integrante: str,
    agente: str,
    modelo: str = "",
    audit_py: Path = AUDIT_PY,
    nota: str = "cola ETL",
) -> list[str]:
    """Arma el comando para correr un paso a través de audit/audit.py."""
    cmd = [
        sys.executable,
        "-I",
        str(audit_py),
        "correr",
        "--integrante",
        integrante,
        "--agente",
        agente,
        "--modelo",
        modelo,
        "--paso",
        paso.id_audit,
    ]
    for s in paso.salidas:
        cmd.extend(["--salida", str(run_dir / s)])
    cmd.extend(["--nota", nota, "--", "pixi", "run", "python", paso.script, *paso.args])
    return cmd


def _normalizar_seleccion(seleccion: Sequence[str], tabla: dict[str, Paso]) -> list[str]:
    por_lower = {k.lower(): k for k in tabla}
    elegidos: list[str] = []
    vistos: set[str] = set()
    for crudo in seleccion:
        clave = crudo if crudo in tabla else por_lower.get(crudo.lower())
        if clave is None:
            validos = ", ".join(tabla)
            raise SystemExit(f"Paso desconocido: {crudo!r}. Válidos: {validos}")
        if clave not in vistos:
            elegidos.append(clave)
            vistos.add(clave)
    return elegidos


def _hijos_de(pasos: Sequence[Paso]) -> dict[str, list[str]]:
    hijos: dict[str, list[str]] = {p.id: [] for p in pasos}
    for p in pasos:
        for u in p.depende_de:
            if u not in hijos:
                raise ValueError(f"Dependencia desconocida en {p.id}: {u}")
            hijos[u].append(p.id)
    return hijos


def _cerradura_downstream(raices: Iterable[str], hijos: dict[str, list[str]]) -> set[str]:
    vistos: set[str] = set()
    cola = deque(raices)
    while cola:
        actual = cola.popleft()
        if actual in vistos:
            continue
        vistos.add(actual)
        for h in hijos[actual]:
            if h not in vistos:
                cola.append(h)
    return vistos


def orden_topologico(pasos: Sequence[Paso], activos: set[str]) -> list[str]:
    """Devuelve los ids activos en orden topológico, conservando el orden de la tabla."""
    tabla = {p.id: p for p in pasos}
    indice = {p.id: i for i, p in enumerate(pasos)}
    grado = {pid: sum(1 for u in tabla[pid].depende_de if u in activos) for pid in activos}
    hijos = {pid: [p.id for p in pasos if p.id in activos and pid in p.depende_de] for pid in activos}
    listos = sorted((pid for pid, g in grado.items() if g == 0), key=indice.__getitem__)
    orden: list[str] = []
    while listos:
        actual = listos.pop(0)
        orden.append(actual)
        for h in hijos[actual]:
            grado[h] -= 1
            if grado[h] == 0:
                listos.append(h)
        listos.sort(key=indice.__getitem__)
    if len(orden) != len(activos):
        raise ValueError("Ciclo detectado en las dependencias del ETL")
    return orden


def _evaluar_estado(
    pasos: Sequence[Paso],
    orden: list[str],
    run_dir: Path,
    etl_dir: Path,
    shared_deps: Sequence[Path],
    forzados: set[str],
) -> tuple[dict[str, list[str]], dict[str, str], dict[str, str], list[str]]:
    """Clasifica los pasos activos en a_correr, sin_script, bloqueados y vigentes."""
    tabla = {p.id: p for p in pasos}
    a_correr: dict[str, list[str]] = {}
    sin_script: dict[str, str] = {}
    bloqueados: dict[str, str] = {}
    vigentes: list[str] = []

    for pid in orden:
        p = tabla[pid]
        bloqueo = next(
            (u for u in p.depende_de if u in sin_script or u in bloqueados),
            None,
        )
        if bloqueo is not None:
            raiz_faltante = bloqueo if bloqueo in sin_script else bloqueados[bloqueo]
            bloqueados[pid] = raiz_faltante
            continue

        script_path = etl_dir / p.script
        if not script_path.is_file():
            sin_script[pid] = p.script
            continue

        motivos: list[str] = []
        if pid in forzados:
            motivos.append("forzado")

        faltantes = [s for s in p.salidas if not (run_dir / s).exists()]
        if faltantes:
            extra = f" (+{len(faltantes) - 1})" if len(faltantes) > 1 else ""
            motivos.append(f"falta salida: {faltantes[0]}{extra}")
        elif p.salidas:
            min_out_ns = min((run_dir / s).stat().st_mtime_ns for s in p.salidas)
            if script_path.stat().st_mtime_ns > min_out_ns:
                motivos.append(f"script {p.script} más reciente")
            for dep in shared_deps:
                if dep.is_file() and dep.stat().st_mtime_ns > min_out_ns:
                    motivos.append(f"{dep.name} más reciente")
            for u in p.depende_de:
                if u not in a_correr:
                    for su in tabla[u].salidas:
                        pu = run_dir / su
                        if pu.exists() and pu.stat().st_mtime_ns > min_out_ns:
                            motivos.append(f"salida de {u} ({su}) más reciente")
                            break

        for u in p.depende_de:
            if u in a_correr:
                motivos.append(f"upstream {u} se ejecutará")

        if motivos:
            a_correr[pid] = motivos
        else:
            vigentes.append(pid)

    return a_correr, sin_script, bloqueados, vigentes


def _correr_uno(
    paso: Paso,
    run_dir: Path,
    etl_dir: Path,
    integrante: str,
    agente: str,
    modelo: str,
    ejecutor: Callable[[Paso, Path, Path], int] | None,
) -> tuple[int, float]:
    log_path = run_dir / f"{paso.id}.log"
    t0 = time.monotonic()
    if ejecutor is not None:
        codigo = ejecutor(paso, run_dir, log_path)
    else:
        cmd = construir_comando_audit(paso, run_dir, integrante, agente, modelo)
        with log_path.open("w", encoding="utf-8", errors="replace") as log_f:
            proc = subprocess.run(cmd, cwd=etl_dir, stdout=log_f, stderr=subprocess.STDOUT, text=True)
            codigo = proc.returncode
    return codigo, time.monotonic() - t0


def _imprimir_plan(
    orden: list[str],
    tabla: dict[str, Paso],
    a_correr: dict[str, list[str]],
    sin_script: dict[str, str],
    bloqueados: dict[str, str],
    vigentes: list[str],
    out: TextIO,
) -> None:
    print("PLAN:", file=out)
    idx = 0
    for pid in orden:
        p = tabla[pid]
        tipo = "pesado" if p.pesado else "ligero"
        if pid in sin_script:
            print(f"  - {pid} ({p.script}, {tipo}): sin script", file=out)
        elif pid in bloqueados:
            print(f"  - {pid} ({p.script}, {tipo}): omitido (upstream {bloqueados[pid]} sin script)", file=out)
        elif pid in a_correr:
            idx += 1
            razones = "; ".join(a_correr[pid])
            print(f"  {idx}. {pid} ({p.script}, {tipo}) -> {razones}", file=out)
    if idx == 0:
        print("  Nada por correr.", file=out)
    if vigentes:
        print(f"Al día ({len(vigentes)}): {', '.join(vigentes)}", file=out)


def ejecutar_cola(
    pasos: Sequence[Paso] = PASOS,
    *,
    seleccion: Sequence[str] = (),
    run_dir: Path,
    etl_dir: Path = ETL_DIR,
    shared_deps: Sequence[Path] | None = None,
    plan: bool = False,
    forzar: bool = False,
    max_paralelo: int = 4,
    max_pesados: int = 1,
    integrante: str | None = None,
    agente: str | None = None,
    modelo: str = "",
    ejecutor: Callable[[Paso, Path, Path], int] | None = None,
    salida: TextIO | None = None,
) -> int:
    """Planifica o ejecuta la cola de pasos del ETL y devuelve 1 si algún paso falló."""
    if max_paralelo < 1:
        raise ValueError("max_paralelo debe ser >= 1")
    if max_pesados < 1:
        raise ValueError("max_pesados debe ser >= 1")

    out = salida if salida is not None else sys.stdout
    tabla = {p.id: p for p in pasos}
    hijos = _hijos_de(pasos)
    deps_comp = tuple(DEPS_COMUNES) if shared_deps is None else tuple(shared_deps)

    if seleccion:
        pedidas = _normalizar_seleccion(seleccion, tabla)
        activos = _cerradura_downstream(pedidas, hijos)
        forzados = set(pedidas) if forzar else set()
    else:
        activos = set(tabla)
        forzados = set(tabla) if forzar else set()

    orden = orden_topologico(pasos, activos)
    a_correr, sin_script, bloqueados, vigentes = _evaluar_estado(
        pasos, orden, run_dir, etl_dir, deps_comp, forzados
    )

    if plan:
        _imprimir_plan(orden, tabla, a_correr, sin_script, bloqueados, vigentes, out)
        return 0

    if ejecutor is None and (not integrante or not agente):
        raise SystemExit("Faltan --integrante y --agente (o AUDIT_INTEGRANTE y AUDIT_AGENTE)")

    for pid in orden:
        if pid in sin_script:
            print(f"[sin script] {pid}: falta {sin_script[pid]}", file=out, flush=True)
        elif pid in bloqueados:
            print(f"[omitido] {pid}: upstream {bloqueados[pid]} sin script", file=out, flush=True)

    run_dir.mkdir(parents=True, exist_ok=True)
    ok: dict[str, float] = {}
    fallo: dict[str, tuple[int, float]] = {}
    omitido: dict[str, str] = {pid: f"upstream {bloqueados[pid]} sin script" for pid in orden if pid in bloqueados}
    pendientes = [pid for pid in orden if pid in a_correr]
    en_vuelo: dict[Future[tuple[int, float]], str] = {}

    def _propagar_omision(raiz: str) -> None:
        cola_om = deque(h for h in hijos[raiz] if h in a_correr)
        while cola_om:
            h = cola_om.popleft()
            if h in omitido or h in ok or h in fallo:
                continue
            omitido[h] = f"fallo de {raiz}"
            print(f"[omitido] {h}: por fallo de {raiz}", file=out, flush=True)
            for hh in hijos[h]:
                if hh in a_correr:
                    cola_om.append(hh)

    with ThreadPoolExecutor(max_workers=max_paralelo) as pool:
        while pendientes or en_vuelo:
            pesados_activos = sum(1 for pid in en_vuelo.values() if tabla[pid].pesado)
            lanzados = False
            restantes: list[str] = []
            for pid in pendientes:
                if pid in omitido:
                    continue
                if len(en_vuelo) >= max_paralelo:
                    restantes.append(pid)
                    continue
                p = tabla[pid]
                deps_pend = [u for u in p.depende_de if u in a_correr and u not in ok]
                if deps_pend:
                    restantes.append(pid)
                    continue
                if p.pesado and pesados_activos >= max_pesados:
                    restantes.append(pid)
                    continue
                print(f"[inicio] {pid} ({p.script})", file=out, flush=True)
                fut = pool.submit(
                    _correr_uno,
                    p,
                    run_dir,
                    etl_dir,
                    integrante or "",
                    agente or "",
                    modelo,
                    ejecutor,
                )
                en_vuelo[fut] = pid
                if p.pesado:
                    pesados_activos += 1
                lanzados = True
            pendientes = restantes

            if not en_vuelo:
                if not lanzados:
                    break
                continue

            terminados, _ = wait(en_vuelo.keys(), return_when=FIRST_COMPLETED)
            for fut in terminados:
                pid = en_vuelo.pop(fut)
                try:
                    codigo, dur = fut.result()
                except Exception as exc:  # noqa: BLE001 - cualquier excepción cuenta como fallo del paso
                    codigo, dur = 1, 0.0
                    print(f"[error] {pid}: {exc}", file=out, flush=True)
                if codigo == 0:
                    ok[pid] = dur
                    print(f"[ok] {pid} ({dur:.1f}s)", file=out, flush=True)
                else:
                    fallo[pid] = (codigo, dur)
                    print(f"[falló] {pid} (código {codigo}, {dur:.1f}s)", file=out, flush=True)
                    _propagar_omision(pid)

    print("\nRESUMEN:", file=out)
    print(f"  ok ({len(ok)}):", file=out)
    for pid, dur in ok.items():
        print(f"    {pid}: {dur:.1f}s", file=out)
    print(f"  falló ({len(fallo)}):", file=out)
    for pid, (cod, dur) in fallo.items():
        print(f"    {pid}: código {cod}, {dur:.1f}s", file=out)
    print(f"  omitido ({len(omitido)}):", file=out)
    for pid, mot in omitido.items():
        print(f"    {pid}: 0.0s ({mot})", file=out)
    if sin_script:
        print(f"  sin script ({len(sin_script)}): {', '.join(sin_script)}", file=out)
    if vigentes:
        print(f"  al día ({len(vigentes)}): {', '.join(vigentes)}", file=out)

    return 1 if fallo else 0


def parsear_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Cola de ejecución del ETL con dependencias y auditoría.")
    p.add_argument("pasos", nargs="*", help="Pasos a considerar (con su downstream desactualizado)")
    p.add_argument("--plan", action="store_true", help="Muestra qué correría, en qué orden y por qué, sin ejecutar")
    p.add_argument("--forzar", action="store_true", help="Marca los pasos indicados como desactualizados")
    p.add_argument("--max-paralelo", type=int, default=4, help="Máximo de pasos simultáneos")
    p.add_argument("--max-pesados", type=int, default=1, help="Máximo de pasos pesados simultáneos")
    p.add_argument("--integrante", default=os.environ.get("AUDIT_INTEGRANTE"), help="Integrante para audit.py")
    p.add_argument("--agente", default=os.environ.get("AUDIT_AGENTE"), help="Agente para audit.py")
    p.add_argument("--modelo", default=os.environ.get("AUDIT_MODELO", ""), help="Modelo para audit.py")
    return p.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    pasos: Sequence[Paso] = PASOS,
    etl_dir: Path | None = None,
    shared_deps: Sequence[Path] | None = None,
    ejecutor: Callable[[Paso, Path, Path], int] | None = None,
    salida: TextIO | None = None,
) -> int:
    args = parsear_args(argv)
    run_val = os.environ.get("RUN")
    if not run_val:
        raise SystemExit("falta la variable de entorno RUN")
    return ejecutar_cola(
        pasos=pasos,
        seleccion=args.pasos,
        run_dir=Path(run_val),
        etl_dir=ETL_DIR if etl_dir is None else etl_dir,
        shared_deps=shared_deps,
        plan=args.plan,
        forzar=args.forzar,
        max_paralelo=args.max_paralelo,
        max_pesados=args.max_pesados,
        integrante=args.integrante,
        agente=args.agente,
        modelo=args.modelo,
        ejecutor=ejecutor,
        salida=salida,
    )


if __name__ == "__main__":
    sys.exit(main())
