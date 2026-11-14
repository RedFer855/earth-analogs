"""Pruebas del registro de auditoría (python -I -m unittest discover -s audit -p 'test_*.py')."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import audit  # noqa: E402

RAIZ = AQUI.parent.parent
VERIFICADOR = AQUI / "verificar.mjs"


class RegistroTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.reg = Path(self.dir.name) / "etl-log.jsonl"
        (Path(self.dir.name) / "team.json").write_text((AQUI / "team.json").read_text(encoding="utf-8"), encoding="utf-8")
        self.base = ["--integrante", "fernando", "--agente", "claude-code", "--modelo", "m", "--registro", str(self.reg)]

    def tearDown(self):
        self.dir.cleanup()

    def lineas(self):
        return [json.loads(l) for l in self.reg.read_text(encoding="utf-8").split("\n") if l.strip()]

    def test_cadena_y_campos(self):
        audit.main(["registrar", "--paso", "E-00", "--evento", "fin", "--nota", "uno", *self.base])
        audit.main(["registrar", "--paso", "E-01", "--evento", "inicio", *self.base])
        a, b = self.lineas()
        self.assertEqual(a["prev"], audit.CERO)
        primera = self.reg.read_text(encoding="utf-8").split("\n")[0]
        self.assertEqual(b["prev"], audit.hashlib.sha256(primera.encode()).hexdigest())
        self.assertTrue(a["ts"].endswith("-06:00"))

    def test_correr_registra_inicio_y_fin(self):
        codigo = audit.main(["correr", "--paso", "E-02", *self.base, "--", sys.executable, "-c", "pass"])
        self.assertEqual(codigo, 0)
        inicio, fin = self.lineas()
        self.assertEqual((inicio["evento"], fin["evento"], fin["resultado"]), ("inicio", "fin", "ok"))
        self.assertIsNotNone(fin["duracion_s"])

    def test_correr_registra_fallo(self):
        codigo = audit.main(["correr", "--paso", "E-02", *self.base, "--", sys.executable, "-c", "raise SystemExit(3)"])
        self.assertEqual(codigo, 3)
        self.assertEqual(self.lineas()[-1]["resultado"], "codigo 3")

    def test_rechaza_actor_y_paso_invalidos(self):
        with self.assertRaises(SystemExit):
            audit.main(["registrar", "--paso", "E-00", "--evento", "fin", "--integrante", "nadie", "--agente", "claude-code", "--registro", str(self.reg)])
        with self.assertRaises(SystemExit):
            audit.main(["registrar", "--paso", "paso1", "--evento", "fin", *self.base])

    def test_no_guarda_rutas_absolutas_fuera_de_raices(self):
        with self.assertRaises(SystemExit):
            audit.ruta_relativa(str(Path(tempfile.gettempdir()).resolve() / "x"), env={})

    def test_ruta_bajo_run(self):
        env = {"RUN": self.dir.name}
        self.assertEqual(audit.ruta_relativa(str(Path(self.dir.name) / "a" / "b.f32"), env), "$RUN/a/b.f32")
        self.assertEqual(audit.limpiar_comando(["x", str(Path(self.dir.name).resolve())], env), "x $RUN")

    @unittest.skipUnless(subprocess.run(["node", "--version"], capture_output=True).returncode == 0, "sin node")
    def test_verificador_detecta_edicion(self):
        audit.main(["registrar", "--paso", "E-00", "--evento", "fin", *self.base])
        audit.main(["registrar", "--paso", "E-01", "--evento", "fin", *self.base])
        ok = subprocess.run(["node", str(VERIFICADOR), str(self.reg)], capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        texto = self.reg.read_text(encoding="utf-8").replace('"E-00"', '"E-09"')
        self.reg.write_text(texto, encoding="utf-8", newline="\n")
        malo = subprocess.run(["node", str(VERIFICADOR), str(self.reg)], capture_output=True, text=True)
        self.assertEqual(malo.returncode, 1)
        self.assertIn("cadena rota", malo.stderr)


if __name__ == "__main__":
    unittest.main()
