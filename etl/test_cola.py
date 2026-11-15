"""Pruebas de etl/cola.py usando tablas y comandos falsos en directorios temporales."""

from __future__ import annotations

import io
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
if str(AQUI) not in sys.path:
    sys.path.insert(0, str(AQUI))

import cola  # noqa: E402
from cola import Paso  # noqa: E402


def _fijar_mtime(ruta: Path, segundos: int) -> None:
    ns = (1_700_000_000 + segundos) * 1_000_000_000
    os.utime(ruta, ns=(ns, ns))


def _escribir_script(etl_dir: Path, nombre: str, contenido: str, mtime: int = 100) -> Path:
    ruta = etl_dir / nombre
    ruta.write_text(contenido, encoding="utf-8")
    _fijar_mtime(ruta, mtime)
    return ruta


def _escribir_salida(run_dir: Path, rel: str, contenido: str = "ok", mtime: int = 200) -> Path:
    ruta = run_dir / rel
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(contenido, encoding="utf-8")
    _fijar_mtime(ruta, mtime)
    return ruta


class PruebasCola(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.etl_dir = self.raiz / "etl"
        self.run_dir = self.raiz / "run"
        self.etl_dir.mkdir()
        self.run_dir.mkdir()
        self.comun = _escribir_script(self.etl_dir, "comun.py", "# comun\n", mtime=50)
        self.comun_tabla = _escribir_script(self.etl_dir, "comun_tabla.py", "# comun_tabla\n", mtime=50)
        self.deps_comp = (self.comun, self.comun_tabla)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _runner_subproceso(self, eventos: list[tuple[str, str, float]], lock: threading.Lock):
        def _correr(paso: Paso, run_dir: Path, log_path: Path) -> int:
            with lock:
                eventos.append(("inicio", paso.id, time.monotonic()))
            with log_path.open("w", encoding="utf-8") as log_f:
                proc = subprocess.run(
                    [sys.executable, str(self.etl_dir / paso.script), *paso.args],
                    cwd=self.etl_dir,
                    env={**os.environ, "RUN": str(run_dir)},
                    stdout=log_f,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
            with lock:
                eventos.append(("fin", paso.id, time.monotonic()))
            return proc.returncode

        return _correr

    def test_orden_dependencias_y_bitacora(self) -> None:
        codigo_script = (
            "import os, sys, pathlib\n"
            "run = pathlib.Path(os.environ['RUN'])\n"
            "out = run / sys.argv[1]\n"
            "out.parent.mkdir(parents=True, exist_ok=True)\n"
            "out.write_text('listo\\n', encoding='utf-8')\n"
            "print('hecho', sys.argv[1])\n"
        )
        for nombre in ("a.py", "b.py", "c.py", "d.py"):
            _escribir_script(self.etl_dir, nombre, codigo_script)

        pasos = (
            Paso("A", "a.py", ("a.out",), ("a.out",), ()),
            Paso("B", "b.py", ("b.out",), ("b.out",), ("A",)),
            Paso("C", "c.py", ("c.out",), ("c.out",), ("A",)),
            Paso("D", "d.py", ("d.out",), ("d.out",), ("B", "C")),
        )
        eventos: list[tuple[str, str, float]] = []
        buf = io.StringIO()
        rc = cola.ejecutar_cola(
            pasos,
            run_dir=self.run_dir,
            etl_dir=self.etl_dir,
            shared_deps=self.deps_comp,
            max_paralelo=2,
            ejecutor=self._runner_subproceso(eventos, threading.Lock()),
            salida=buf,
        )
        self.assertEqual(rc, 0)
        tiempos = {(ev, pid): t for ev, pid, t in eventos}
        self.assertLessEqual(tiempos[("fin", "A")], tiempos[("inicio", "B")])
        self.assertLessEqual(tiempos[("fin", "A")], tiempos[("inicio", "C")])
        self.assertLessEqual(tiempos[("fin", "B")], tiempos[("inicio", "D")])
        self.assertLessEqual(tiempos[("fin", "C")], tiempos[("inicio", "D")])
        for pid in ("A", "B", "C", "D"):
            self.assertTrue((self.run_dir / f"{pid}.log").is_file())
            self.assertIn("hecho", (self.run_dir / f"{pid}.log").read_text(encoding="utf-8"))
        self.assertIn("ok (4)", buf.getvalue())

    def test_desactualizacion_por_mtime(self) -> None:
        for nombre in ("a.py", "b.py", "c.py"):
            _escribir_script(self.etl_dir, nombre, "# ok\n", mtime=100)
        pasos = (
            Paso("A", "a.py", (), ("a.out",), ()),
            Paso("B", "b.py", (), ("b.out",), ("A",)),
            Paso("C", "c.py", (), ("c.out",), ()),
        )
        _escribir_salida(self.run_dir, "a.out", mtime=200)
        _escribir_salida(self.run_dir, "b.out", mtime=250)
        _escribir_salida(self.run_dir, "c.out", mtime=200)

        corridos: list[str] = []

        def _fake(paso: Paso, run_dir: Path, log_path: Path) -> int:
            corridos.append(paso.id)
            _escribir_salida(run_dir, paso.salidas[0], mtime=500)
            return 0

        # Todo al día: no corre nada.
        rc = cola.ejecutar_cola(
            pasos, run_dir=self.run_dir, etl_dir=self.etl_dir, shared_deps=self.deps_comp, ejecutor=_fake, salida=io.StringIO()
        )
        self.assertEqual(rc, 0)
        self.assertEqual(corridos, [])

        # Script de A más reciente -> corre A y su downstream B, no C.
        _fijar_mtime(self.etl_dir / "a.py", 300)
        rc = cola.ejecutar_cola(
            pasos, run_dir=self.run_dir, etl_dir=self.etl_dir, shared_deps=self.deps_comp, ejecutor=_fake, salida=io.StringIO()
        )
        self.assertEqual(rc, 0)
        self.assertEqual(corridos, ["A", "B"])

        # Salida de A más reciente que salida de B -> solo corre B.
        corridos.clear()
        _fijar_mtime(self.run_dir / "b.out", 400)
        rc = cola.ejecutar_cola(
            pasos, run_dir=self.run_dir, etl_dir=self.etl_dir, shared_deps=self.deps_comp, ejecutor=_fake, salida=io.StringIO()
        )
        self.assertEqual(rc, 0)
        self.assertEqual(corridos, ["B"])

        # comun_tabla.py más reciente -> corren todos los afectados.
        corridos.clear()
        _fijar_mtime(self.comun_tabla, 600)
        rc = cola.ejecutar_cola(
            pasos, run_dir=self.run_dir, etl_dir=self.etl_dir, shared_deps=self.deps_comp, ejecutor=_fake, salida=io.StringIO()
        )
        self.assertEqual(rc, 0)
        # B y C dependen solo de A y pueden correr en paralelo: importa que A vaya primero, no el orden entre ellos
        self.assertEqual(corridos[0], "A")
        self.assertEqual(sorted(corridos[1:]), ["B", "C"])

    def test_seleccion_y_forzar(self) -> None:
        for nombre in ("a.py", "b.py", "c.py", "d.py"):
            _escribir_script(self.etl_dir, nombre, "# ok\n", mtime=100)
        pasos = (
            Paso("A", "a.py", (), ("a.out",), ()),
            Paso("B", "b.py", (), ("b.out",), ("A",)),
            Paso("C", "c.py", (), ("c.out",), ("B",)),
            Paso("D", "d.py", (), ("d.out",), ()),
        )
        for s in ("a.out", "b.out", "c.out", "d.out"):
            _escribir_salida(self.run_dir, s, mtime=200)

        corridos: list[str] = []

        def _fake(paso: Paso, run_dir: Path, log_path: Path) -> int:
            corridos.append(paso.id)
            return 0

        # --forzar B corre B y su downstream C; ignora A y D.
        rc = cola.ejecutar_cola(
            pasos,
            seleccion=("B",),
            forzar=True,
            run_dir=self.run_dir,
            etl_dir=self.etl_dir,
            shared_deps=self.deps_comp,
            ejecutor=_fake,
            salida=io.StringIO(),
        )
        self.assertEqual(rc, 0)
        self.assertEqual(corridos, ["B", "C"])

    def test_plan_no_ejecuta_nada(self) -> None:
        _escribir_script(self.etl_dir, "a.py", "# a\n", mtime=100)
        _escribir_script(self.etl_dir, "b.py", "# b\n", mtime=100)
        pasos = (
            Paso("A", "a.py", (), ("a.out",), ()),
            Paso("B", "b.py", (), ("b.out",), ("A",)),
        )
        llamadas: list[str] = []

        def _no_llamar(paso: Paso, run_dir: Path, log_path: Path) -> int:
            llamadas.append(paso.id)
            return 0

        run_nuevo = self.raiz / "run_inexistente"
        buf = io.StringIO()
        prev_run = os.environ.get("RUN")
        os.environ["RUN"] = str(run_nuevo)
        try:
            rc = cola.main(
                ["--plan"],
                pasos=pasos,
                etl_dir=self.etl_dir,
                shared_deps=self.deps_comp,
                ejecutor=_no_llamar,
                salida=buf,
            )
        finally:
            if prev_run is None:
                os.environ.pop("RUN", None)
            else:
                os.environ["RUN"] = prev_run

        self.assertEqual(rc, 0)
        self.assertEqual(llamadas, [])
        self.assertFalse(run_nuevo.exists())
        texto = buf.getvalue()
        self.assertIn("PLAN:", texto)
        self.assertLess(texto.index("1. A"), texto.index("2. B"))
        self.assertIn("falta salida", texto)
        self.assertIn("upstream A se ejecutará", texto)

    def test_limites_paralelo_y_pesados(self) -> None:
        for i in range(1, 7):
            _escribir_script(self.etl_dir, f"p{i}.py", "# p\n")
        pasos = (
            Paso("H1", "p1.py", (), ("h1.out",), (), pesado=True),
            Paso("H2", "p2.py", (), ("h2.out",), (), pesado=True),
            Paso("H3", "p3.py", (), ("h3.out",), (), pesado=True),
            Paso("L1", "p4.py", (), ("l1.out",), (), pesado=False),
            Paso("L2", "p5.py", (), ("l2.out",), (), pesado=False),
            Paso("L3", "p6.py", (), ("l3.out",), (), pesado=False),
        )
        lock = threading.Lock()
        activos = 0
        pesados_activos = 0
        max_activos = 0
        max_pesados = 0

        def _fake(paso: Paso, run_dir: Path, log_path: Path) -> int:
            nonlocal activos, pesados_activos, max_activos, max_pesados
            with lock:
                activos += 1
                if paso.pesado:
                    pesados_activos += 1
                max_activos = max(max_activos, activos)
                max_pesados = max(max_pesados, pesados_activos)
            time.sleep(0.06)
            with lock:
                activos -= 1
                if paso.pesado:
                    pesados_activos -= 1
            return 0

        rc = cola.ejecutar_cola(
            pasos,
            run_dir=self.run_dir,
            etl_dir=self.etl_dir,
            shared_deps=self.deps_comp,
            max_paralelo=3,
            max_pesados=1,
            ejecutor=_fake,
            salida=io.StringIO(),
        )
        self.assertEqual(rc, 0)
        self.assertLessEqual(max_activos, 3)
        self.assertGreaterEqual(max_activos, 2)
        self.assertEqual(max_pesados, 1)

    def test_fallo_omite_downstream_y_retorna_uno(self) -> None:
        _escribir_script(self.etl_dir, "ok.py", "print('ok')\n")
        _escribir_script(self.etl_dir, "falla.py", "import sys; sys.exit(2)\n")
        pasos = (
            Paso("A", "ok.py", (), ("a.out",), ()),
            Paso("B", "falla.py", (), ("b.out",), ("A",)),
            Paso("C", "ok.py", (), ("c.out",), ("B",)),
            Paso("D", "ok.py", (), ("d.out",), ()),
        )
        corridos: list[str] = []
        lock = threading.Lock()
        buf = io.StringIO()

        def _fake(paso: Paso, run_dir: Path, log_path: Path) -> int:
            with lock:
                corridos.append(paso.id)
            proc = subprocess.run(
                [sys.executable, str(self.etl_dir / paso.script)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            log_path.write_text(proc.stdout, encoding="utf-8")
            return proc.returncode

        rc = cola.ejecutar_cola(
            pasos,
            run_dir=self.run_dir,
            etl_dir=self.etl_dir,
            shared_deps=self.deps_comp,
            max_paralelo=2,
            ejecutor=_fake,
            salida=buf,
        )
        self.assertEqual(rc, 1)
        self.assertIn("A", corridos)
        self.assertIn("B", corridos)
        self.assertIn("D", corridos)
        self.assertNotIn("C", corridos)
        resumen = buf.getvalue()
        self.assertIn("ok (2):", resumen)
        self.assertIn("falló (1):", resumen)
        self.assertIn("omitido (1):", resumen)
        self.assertIn("C: 0.0s (fallo de B)", resumen)

    def test_sin_script_omite_downstream(self) -> None:
        _escribir_script(self.etl_dir, "ok.py", "# ok\n")
        pasos = (
            Paso("E-15", "e15_no_existe.py", (), ("e15.out",), ()),
            Paso("E-13", "ok.py", (), ("manifest.json",), ("E-15",)),
            Paso("E-02", "ok.py", (), ("e02.json",), ()),
        )
        corridos: list[str] = []
        buf = io.StringIO()

        def _fake(paso: Paso, run_dir: Path, log_path: Path) -> int:
            corridos.append(paso.id)
            return 0

        rc = cola.ejecutar_cola(
            pasos,
            run_dir=self.run_dir,
            etl_dir=self.etl_dir,
            shared_deps=self.deps_comp,
            ejecutor=_fake,
            salida=buf,
        )
        self.assertEqual(rc, 0)
        self.assertEqual(corridos, ["E-02"])
        texto = buf.getvalue()
        self.assertIn("sin script", texto)
        self.assertIn("E-13", texto)
        self.assertNotIn("E-13", corridos)

    def test_tabla_real_y_comando_auditoria(self) -> None:
        por_id = {p.id: p for p in cola.PASOS}
        pesados = {p.id for p in cola.PASOS if p.pesado}
        self.assertEqual(pesados, {"E-03", "E-04", "E-05", "E-07", "E-15"})
        self.assertIn("E-15", por_id)
        self.assertEqual(por_id["E-15"].script, "e15_capas_30m.py")
        # E-13 espera a todos los pasos que escriben la tabla; E-20 y E-21 leen el manifiesto, así que van después
        self.assertEqual(set(por_id["E-13"].depende_de), set(por_id) - {"E-13", "E-20", "E-21"})
        self.assertEqual(por_id["E-20"].depende_de, ("E-13",))
        self.assertEqual(por_id["E-21"].depende_de, ("E-13",))
        self.assertIn("web/capas7/capas7.json", por_id["E-21"].salidas)

        cmd = cola.construir_comando_audit(
            por_id["E-03"],
            self.run_dir,
            integrante="fernando",
            agente="antigravity",
            modelo="m",
        )
        self.assertEqual(cmd[1:4], ["-I", str(cola.AUDIT_PY), "correr"])
        self.assertIn("--paso", cmd)
        self.assertEqual(cmd[cmd.index("--paso") + 1], "E-03")
        sep = cmd.index("--")
        self.assertEqual(cmd[sep + 1 :], ["pixi", "run", "python", "e03_extras.py"])


if __name__ == "__main__":
    unittest.main()
