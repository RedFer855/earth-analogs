"""Registro de auditoría del ETL: una línea JSON por evento en etl-log.jsonl, encadenada por sha256.

Uso:
    python audit/audit.py registrar --paso E-01 --evento fin --resultado ok --nota "..." [--salida RUTA ...]
    python audit/audit.py correr --paso E-03 [--salida RUTA ...] -- python etl/terreno.py ...

Integrante, agente y modelo salen de --integrante/--agente/--modelo o de AUDIT_INTEGRANTE, AUDIT_AGENTE y
AUDIT_MODELO. Las rutas bajo RUN o DATOS se guardan como $RUN/... y $DATOS/...; nunca rutas absolutas.
Solo biblioteca estándar.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
REGISTRO = AQUI / "etl-log.jsonl"
EQUIPO = json.loads((AQUI / "team.json").read_text(encoding="utf-8"))
ZONA = timezone(timedelta(hours=-6))  # Tegucigalpa, sin horario de verano
CERO = "0" * 64


def ahora() -> str:
    return datetime.now(ZONA).isoformat(timespec="seconds")


def ultima_linea(registro: Path) -> str | None:
    if not registro.exists():
        return None
    # split("\n") y no splitlines(): igual que el verificador, que no corta en U+2028.
    lineas = [l.rstrip("\r") for l in registro.read_text(encoding="utf-8").split("\n") if l.strip()]
    return lineas[-1] if lineas else None


def hash_previo(registro: Path) -> str:
    linea = ultima_linea(registro)
    return hashlib.sha256(linea.encode("utf-8")).hexdigest() if linea else CERO


def raices(env=os.environ) -> list[tuple[str, Path]]:
    pares = []
    for nombre in ("RUN", "DATOS"):
        if env.get(nombre):
            pares.append((f"${nombre}", Path(env[nombre]).resolve()))
    pares.append((".", RAIZ))
    return pares


def ruta_relativa(ruta: str, env=os.environ) -> str:
    p = Path(ruta)
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    for marca, base in raices(env):
        try:
            rel = p.resolve().relative_to(base)
        except ValueError:
            continue
        return f"{marca}/{rel.as_posix()}" if marca != "." else rel.as_posix()
    raise SystemExit(f"audit: {ruta} no está bajo RUN, DATOS ni el repo; no se registran rutas absolutas")


def limpiar_comando(partes: list[str], env=os.environ) -> str:
    texto = " ".join(partes)
    for marca, base in raices(env):
        for forma in {str(base), base.as_posix()}:
            texto = texto.replace(forma, marca)
    return texto


def sha256_archivo(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def describir_salida(ruta: str, con_hash: bool, env=os.environ) -> dict:
    p = Path(ruta)
    if not p.exists():
        return {"ruta": ruta_relativa(ruta, env), "existe": False}
    if p.is_dir():
        archivos = [a for a in p.rglob("*") if a.is_file()]
        d = {"ruta": ruta_relativa(ruta, env), "archivos": len(archivos), "bytes": sum(a.stat().st_size for a in archivos)}
        manifiesto = p / "manifest.json"
        if con_hash and manifiesto.exists():
            d["sha256_manifest"] = sha256_archivo(manifiesto)
        return d
    d = {"ruta": ruta_relativa(ruta, env), "bytes": p.stat().st_size}
    if con_hash:
        d["sha256"] = sha256_archivo(p)
    return d


def commit_actual() -> tuple[str, bool]:
    try:
        cabeza = subprocess.run(["git", "rev-parse", "--short=12", "HEAD"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
        sucio = subprocess.run(["git", "status", "--porcelain"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip() != ""
        return cabeza, not sucio
    except (OSError, subprocess.CalledProcessError):
        return "", False


def validar_actor(integrante: str | None, agente: str | None) -> None:
    if integrante not in EQUIPO["integrantes"]:
        raise SystemExit(f"audit: integrante desconocido {integrante!r}; usa uno de {EQUIPO['integrantes']}")
    if agente not in EQUIPO["agentes"]:
        raise SystemExit(f"audit: agente desconocido {agente!r}; usa uno de {EQUIPO['agentes']}")


def construir(args, evento: str, comando: str, duracion: float | None, resultado: str, registro: Path) -> dict:
    validar_actor(args.integrante, args.agente)
    if not args.paso or not (args.paso.startswith("E-") and args.paso[2:].isdigit() and len(args.paso) == 4):
        raise SystemExit("audit: --paso debe ser E-NN")
    if evento not in EQUIPO["eventos"]:
        raise SystemExit(f"audit: evento desconocido {evento!r}")
    cabeza, limpio = commit_actual()
    return {
        "ts": ahora(),
        "integrante": args.integrante,
        "agente": args.agente,
        "modelo": args.modelo or "",
        "paso": args.paso,
        "evento": evento,
        "comando": comando,
        "commit": cabeza,
        "arbol_limpio": limpio,
        "duracion_s": None if duracion is None else round(duracion, 1),
        "salidas": [describir_salida(s, not args.sin_hash) for s in (args.salida or [])],
        "resultado": resultado,
        "nota": args.nota or "",
        "prev": hash_previo(registro),
    }


def agregar(entrada: dict, registro: Path) -> None:
    linea = json.dumps(entrada, ensure_ascii=False, separators=(",", ":"))
    with registro.open("a", encoding="utf-8", newline="\n") as f:
        f.write(linea + "\n")
    print(f"audit: {entrada['paso']} {entrada['evento']} {entrada['resultado']} ({entrada['ts']})")


def argumentos(argv: list[str]):
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument("--paso", required=True)
    comun.add_argument("--integrante", default=os.environ.get("AUDIT_INTEGRANTE"))
    comun.add_argument("--agente", default=os.environ.get("AUDIT_AGENTE"))
    comun.add_argument("--modelo", default=os.environ.get("AUDIT_MODELO"))
    comun.add_argument("--salida", action="append", help="archivo o carpeta producida (se puede repetir)")
    comun.add_argument("--nota")
    comun.add_argument("--sin-hash", action="store_true", help="no calcular sha256 de las salidas")
    comun.add_argument("--registro", default=str(REGISTRO), help=argparse.SUPPRESS)

    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="orden", required=True)
    r = sub.add_parser("registrar", parents=[comun])
    r.add_argument("--evento", required=True)
    r.add_argument("--resultado", default="ok")
    r.add_argument("--comando", default="")
    c = sub.add_parser("correr", parents=[comun])
    c.add_argument("cmd", nargs=argparse.REMAINDER)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = argumentos(sys.argv[1:] if argv is None else argv)
    registro = Path(args.registro)
    if args.orden == "registrar":
        agregar(construir(args, args.evento, args.comando, None, args.resultado, registro), registro)
        return 0

    cmd = args.cmd[1:] if args.cmd and args.cmd[0] == "--" else args.cmd
    if not cmd:
        raise SystemExit("audit: falta el comando después de --")
    comando = limpiar_comando(cmd)
    salidas, args.salida = args.salida, None
    agregar(construir(args, "inicio", comando, None, "", registro), registro)
    t0 = time.monotonic()
    codigo = subprocess.run(cmd).returncode
    args.salida = salidas
    evento, resultado = ("fin", "ok") if codigo == 0 else ("fallo", f"codigo {codigo}")
    agregar(construir(args, evento, comando, time.monotonic() - t0, resultado, registro), registro)
    return codigo


if __name__ == "__main__":
    sys.exit(main())
