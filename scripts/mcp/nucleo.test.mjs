import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { explicacionAMarkdown, explicarCandidato } from './explicacion.mjs';
import { ang2pixNested, centroNested, enBbox, geodesicaAAutalica, autalicaAGeodesica } from './healpix.mjs';
import {
  RAIZ_REPO,
  _reiniciarParaPruebas,
  armarArgumentos,
  archivoDeCorrida,
  candidatoCompleto,
  consultarPines,
  ejecutarEscenarios,
  ejecutarMotor,
  estadoCorrida,
  listarObjetivos,
  listarResultados,
  obtenerCandidatos,
  resumirCapas7,
} from './nucleo.mjs';
import { crearDatosPrueba } from './pruebas/datos-prueba.mjs';
import {
  ErrorValidacion,
  aplicarPerfilPersonalizado,
  redactarSecretos,
  validarBbox,
  validarEscenarios,
  validarGeoJson,
  validarParametrosMotor,
} from './validacion.mjs';

const CLAVE_GEMINI = `AIza${'x'.repeat(35)}`;
const CLAVE_OPENAI = `sk-proj-${'y'.repeat(40)}`;

describe('validación', () => {
  test('acepta los valores por omisión y rechaza campos desconocidos', () => {
    const v = validarParametrosMotor({});
    assert.equal(v.objetivo, 'JZ');
    assert.equal(v.perfil, 'terreno');
    assert.equal(v.candidatos, 200);
    assert.throws(() => validarParametrosMotor({ maestro: 'C:/' }), /desconocido: maestro/);
    assert.throws(() => validarParametrosMotor({ salida: '../x' }), ErrorValidacion);
  });

  test('rechaza ids con rutas o inyección', () => {
    for (const malo of ['../JZ', 'JZ;rm -rf', 'a/b', '', 'x'.repeat(33), 'JZ --maestro', '$(id)']) {
      assert.throws(() => validarParametrosMotor({ objetivo: malo }), ErrorValidacion, malo);
    }
  });

  test('límites numéricos', () => {
    assert.throws(() => validarParametrosMotor({ candidatos: 0 }));
    assert.throws(() => validarParametrosMotor({ candidatos: 501 }));
    assert.throws(() => validarParametrosMotor({ candidatos: 2.5 }));
    assert.throws(() => validarParametrosMotor({ hilos: 65 }));
    assert.throws(() => validarParametrosMotor({ k_area: 0 }));
    assert.equal(validarParametrosMotor({ k_area: 1 }).k_area, 1);
    assert.throws(() => validarParametrosMotor({ min_area_km2: -1 }));
    assert.throws(() => validarParametrosMotor({ separacion_km: Number.NaN }));
    assert.throws(() => validarParametrosMotor({ solo_barrido: 'sí' }));
  });

  test('bbox', () => {
    assert.deepEqual(validarBbox('10,20,30,40'), [10, 20, 30, 40]);
    assert.deepEqual(validarBbox([-10, 170, 10, -170]), [-10, 170, 10, -170]);
    assert.throws(() => validarBbox([91, 0, 0, 0]));
    assert.throws(() => validarBbox([0, 0, 0]));
    assert.throws(() => validarBbox([0, 0, 0, 181]));
    assert.throws(() => validarParametrosMotor({ bbox: [0, 0, 1, 1], region_geojson: {} }), /no ambos/);
  });

  test('GeoJSON', () => {
    const pol = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    assert.equal(validarGeoJson(pol), pol);
    assert.ok(validarGeoJson({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: pol }] }));
    assert.throws(() => validarGeoJson({ type: 'Point', coordinates: [0, 0] }));
    assert.throws(() => validarGeoJson({ type: 'Polygon', coordinates: [[[0, 0], [1, 0]]] }));
    assert.throws(() => validarGeoJson({ type: 'Polygon', coordinates: [[[0, 0], [200, 0], [1, 1], [0, 0]]] }));
  });

  test('perfil personalizado sobre el perfil base', () => {
    const base = {
      variables: ['a_x', 'b_y'],
      objetivo: { a_x: 1, b_y: 2 },
      tolerancia: { a_x: 1, b_y: 1 },
      escala_tierra: { a_x: 1, b_y: 1 },
      correlacion: [[1, 0], [0, 1]],
    };
    const v = validarParametrosMotor({ perfil_personalizado: { a_x: { peso: 2, tolerancia: 0.5 } } });
    const p = aplicarPerfilPersonalizado(base, v.perfil_personalizado);
    assert.deepEqual(p.pesos, { a_x: 2 });
    assert.equal(p.tolerancia.a_x, 0.5);
    assert.equal(base.tolerancia.a_x, 1, 'no muta el base');
    assert.throws(() => aplicarPerfilPersonalizado(base, { zz: { peso: 1 } }), /no está en el perfil/);
    assert.throws(() => aplicarPerfilPersonalizado(base, { a_x: { peso: 0 }, b_y: { peso: 0 } }), /todos los pesos/);
    assert.throws(() => validarParametrosMotor({ perfil_personalizado: { a_x: { tolerancia: 0 } } }));
    assert.throws(() => validarParametrosMotor({ perfil_personalizado: { a_x: { escala: 1 } } }), /desconocido/);
  });

  test('escenarios', () => {
    const e = validarEscenarios([{ id: 'e1', objetivo: 'JZ', perfil: 'terreno', factor_tolerancia: 2 }]);
    assert.equal(e.escenarios[0].factor_tolerancia, 2);
    assert.throws(() => validarEscenarios([{ id: 'e1', objetivo: 'JZ', ruta: 'x' }]), /desconocido/);
    assert.throws(() => validarEscenarios([{ id: 'e', objetivo: 'JZ' }, { id: 'e', objetivo: 'JZ' }]), /repetido/);
    assert.throws(() => validarEscenarios([]));
  });

  test('redactarSecretos', () => {
    const t = `fallo con ${CLAVE_GEMINI} y Bearer ${CLAVE_OPENAI} en https://x/y?key=${CLAVE_GEMINI}&a=1 x-goog-api-key: abcdef123`;
    const r = redactarSecretos(t);
    assert.ok(!r.includes(CLAVE_GEMINI));
    assert.ok(!r.includes(CLAVE_OPENAI));
    assert.ok(!r.includes('abcdef123'));
    assert.match(r, /a=1/);
    assert.equal(redactarSecretos('clave-propia-123456 ok', ['clave-propia-123456']), '*** ok');
    assert.equal(redactarSecretos(`sk-ant-api03-${'z'.repeat(30)}`), 'sk-ant-***');
  });
});

describe('HEALPix', () => {
  test('ang2pix nested coincide con el ipix del motor y el centro vuelve', () => {
    assert.equal(ang2pixNested(4096, 31.12002, 2.46094), 83282940);
    const [lat, lon] = centroNested(4096, 83282940);
    assert.ok(Math.abs(lat - 31.12002) < 1e-4 && Math.abs(lon - 2.46094) < 1e-4);
    for (const [la, lo] of [[0, 0], [89.9, 10], [-89.9, -170], [45, 179.99], [-60, -45]]) {
      const p = ang2pixNested(128, la, lo);
      assert.equal(ang2pixNested(128, ...centroNested(128, p)), p);
    }
  });

  test('autálica ida y vuelta', () => {
    for (const x of [-80, -30, 0, 15, 60, 89]) assert.ok(Math.abs(autalicaAGeodesica(geodesicaAAutalica(x)) - x) < 1e-6);
  });

  test('bbox que cruza ±180°', () => {
    assert.ok(enBbox([-10, 170, 10, -170], 0, 179));
    assert.ok(!enBbox([-10, 170, 10, -170], 0, 0));
  });
});

describe('datos publicados', () => {
  let env;
  before(() => {
    const d = crearDatosPrueba();
    env = { EA_DATOS: d.datos, EA_SALIDAS: join(d.raiz, 'salidas') };
  });
  beforeEach(() => _reiniciarParaPruebas());

  test('objetivos y resultados', () => {
    const o = listarObjetivos(env);
    assert.ok(o.objetivos.some((x) => x.codigo === 'JZ' && x.cuerpo === 'marte' && x.mejor_nota === 1));
    assert.ok(o.objetivos.some((x) => x.cuerpo === 'luna'));
    const r = listarResultados(env);
    assert.deepEqual(r.resultados.map((x) => x.sitio).sort(), ['CB', 'JZ']);
  });

  test('candidatos con filtros', () => {
    const c = obtenerCandidatos({ objetivo: 'JZ', limite: 2 }, env);
    assert.equal(c.candidatos.length, 2);
    assert.equal(c.candidatos[0].rango, 1);
    assert.deepEqual(c.candidatos[0].difieren, []);
    const caja = obtenerCandidatos({ objetivo: 'JZ', bbox: [20, -10, 35, 10] }, env);
    assert.deepEqual(caja.candidatos.map((x) => x.rango), [1, 3]);
    assert.throws(() => obtenerCandidatos({ objetivo: 'XX' }, env), /No hay resultados/);
    assert.throws(() => obtenerCandidatos({ objetivo: '../../etc' }, env), ErrorValidacion);
  });

  test('explicación determinista', () => {
    const e = explicarCandidato(candidatoCompleto({ objetivo: 'JZ', rango: 2 }, env));
    assert.equal(e.objetivo.cuerpo, 'marte');
    assert.equal(e.coinciden.length, 4);
    assert.ok(e.advertencias.some((a) => a.includes('hielo')), 'candidato 2 está en Groenlandia');
    assert.ok(e.diferencias_planetarias.gravedad_ms2.objetivo < 4);
    assert.ok(e.diagnostico_no_puntua.length > 0);
    const md = explicacionAMarkdown(e);
    assert.match(md, /Candidato #2/);
    assert.match(md, /Lo que ningún dato captura/);
    assert.equal(explicacionAMarkdown(e), md, 'mismo texto cada vez');
    const e1 = explicarCandidato(candidatoCompleto({ objetivo: 'JZ', ipix: 83282940 }, env));
    assert.equal(e1.candidato.rango, 1);
    assert.equal(e1.advertencias.length, 0);
  });

  test('pines', () => {
    const p = consultarPines({ lat: 31, lon: 2.5, radio_km: 100 }, env);
    assert.equal(p.total_filtrados, 1);
    assert.equal(p.pines[0].id, 't1');
    assert.equal(consultarPines({ tipo: 'playa_salar' }, env).pines[0].nombre, 'Salar C');
    assert.throws(() => consultarPines({ tipo: 'volcan' }, env));
  });

  test('capas7 en un punto y en una caja', () => {
    const p = resumirCapas7({ lat: 31.12, lon: 2.46 }, env);
    assert.equal(p.en_tierra, true);
    assert.equal(p.valores.slope_mean_deg.valor, 3);
    assert.equal(p.valores.slope_mean_deg.posicion, 'entre p50 y p99');
    assert.equal(resumirCapas7({ lat: 0, lon: -150 }, env).en_tierra, false);
    const c = resumirCapas7({ bbox: [-90, -180, 90, 180] }, env);
    assert.equal(c.celdas_en_caja, 3);
    assert.equal(c.resumen.slope_mean_deg.con_dato, 2);
    assert.equal(c.resumen.slope_mean_deg.mediana, 2);
  });
});

describe('motor', () => {
  let env;
  let d;
  before(() => {
    d = crearDatosPrueba();
    const run = join(d.raiz, 'run');
    mkdirSync(run);
    const base = JSON.parse(readFileSync(join(RAIZ_REPO, 'visor', 'pruebas', 'datos', 'resultados', 'terreno', 'JZ.json'), 'utf8'));
    const vars = base.parametros.variables.map((v) => v.id);
    const mapa = (f) => Object.fromEntries(vars.map((v) => [v, f(v)]));
    writeFileSync(
      join(run, 'perfiles.json'),
      JSON.stringify({
        parametros: {},
        objetivos: {
          JZ: {
            nombre: 'Jezero',
            cuerpo: 'marte',
            perfiles: {
              terreno: {
                variables: vars,
                objetivo: mapa(() => 1),
                tolerancia: mapa(() => 1),
                escala_tierra: mapa(() => 1),
                correlacion: vars.map((_, i) => vars.map((__, j) => (i === j ? 1 : 0))),
              },
            },
          },
        },
      }),
    );
    env = {
      RUN: run,
      EA_DATOS: d.datos,
      EA_SALIDAS: join(d.raiz, 'salidas'),
      EA_PIPELINE: join(RAIZ_REPO, 'scripts', 'mcp', 'pruebas', 'motor-simulado.mjs'),
    };
  });
  beforeEach(() => _reiniciarParaPruebas());
  after(() => _reiniciarParaPruebas());

  test('armado exacto de los argumentos', () => {
    const v = validarParametrosMotor({
      objetivo: 'CB',
      candidatos: 50,
      hilos: 4,
      bbox: '10,20,30,40',
      separacion_km: 25,
      excluir_km: 100,
      k_area: 0.2,
      min_area_km2: 0,
      usar_puntos: true,
      solo_barrido: true,
    });
    const a = armarArgumentos(v, { run: 'R', runPuntos: 'P', sitios: 'S', salida: 'O', perfilJson: 'PJ' });
    assert.deepEqual(a, [
      '--maestro', 'R', '--perfiles', join('R', 'perfiles.json'), '--sitios', 'S', '--salida', 'O',
      '--objetivo', 'CB', '--perfil', 'terreno', '--candidatos', '50', '--hilos', '4', '--perfil-json', 'PJ',
      '--bbox', '10,20,30,40', '--separacion-km', '25', '--excluir-km', '100', '--k-area', '0.2',
      '--min-area-km2', '0', '--puntos', 'P', '--solo-barrido',
    ]);
    const sinPuntos = armarArgumentos(validarParametrosMotor({ usar_puntos: true }), { run: 'R', sitios: 'S', salida: 'O' });
    assert.ok(!sinPuntos.includes('--puntos'));
  });

  test('corrida completa con perfil personalizado y región, sin dejar temporales', async () => {
    const region = { type: 'Polygon', coordinates: [[[0, 0], [5, 0], [5, 5], [0, 0]]] };
    const e = await ejecutarMotor(
      { objetivo: 'JZ', perfil_personalizado: { slope_mean_deg: { peso: 3, tolerancia: 0.5 } }, region_geojson: region },
      { esperar_s: 10, env },
    );
    assert.equal(e.estado, 'ok', JSON.stringify(e));
    assert.equal(e.mejores.length, 3);
    const dir = join(env.EA_SALIDAS, e.id);
    const llamada = JSON.parse(readFileSync(join(dir, 'llamada.json'), 'utf8'));
    assert.equal(llamada.perfil.pesos.slope_mean_deg, 3);
    assert.equal(llamada.perfil.tolerancia.slope_mean_deg, 0.5);
    assert.deepEqual(llamada.region, region);
    assert.ok(!existsSync(join(dir, '_entrada')), 'borra la carpeta temporal');
    assert.ok(readdirSync(dir).includes('metrics.json'));
    const c = obtenerCandidatos({ objetivo: 'JZ', corrida: e.id }, env);
    assert.equal(c.total_en_archivo, 3);
    assert.ok(archivoDeCorrida(e.id, 'resultados/terreno/JZ.json', env).endsWith('JZ.json'));
    assert.throws(() => archivoDeCorrida(e.id, '../../x.json', env));
    assert.throws(() => archivoDeCorrida(e.id, 'resultados/terreno/../../a.json', env));
  });

  test('una corrida a la vez y estado mientras corre', async () => {
    const lento = { ...env, MOTOR_SIMULADO_LENTO: '1' };
    // el hijo hereda process.env, no `env`; se activa el modo lento por process.env
    process.env.MOTOR_SIMULADO_LENTO = '1';
    try {
      const e = await ejecutarMotor({}, { env: lento });
      assert.equal(e.estado, 'corriendo');
      await assert.rejects(() => ejecutarMotor({}, { env: lento }), /Ya hay una corrida/);
      for (let i = 0; i < 50 && estadoCorrida(e.id).estado === 'corriendo'; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(estadoCorrida(e.id).estado, 'ok');
    } finally {
      delete process.env.MOTOR_SIMULADO_LENTO;
    }
  });

  test('un error del motor sale redactado', async () => {
    process.env.MOTOR_SIMULADO_FALLA = '1';
    try {
      const e = await ejecutarMotor({}, { esperar_s: 10, env });
      assert.equal(e.estado, 'error');
      assert.ok(!e.stderr.includes(CLAVE_GEMINI));
      assert.match(e.stderr, /AIza\*\*\*/);
      assert.match(e.error, /^clave AIza\*\*\* filtrada$/, 'la causa sale del stderr del motor');
    } finally {
      delete process.env.MOTOR_SIMULADO_FALLA;
    }
  });

  test('escenarios', async () => {
    const e = await ejecutarEscenarios({ escenarios: [{ id: 'base', objetivo: 'JZ', perfil: 'terreno' }] }, { esperar_s: 10, env });
    assert.equal(e.estado, 'ok');
    const llamada = JSON.parse(readFileSync(join(env.EA_SALIDAS, e.id, 'llamada.json'), 'utf8'));
    assert.ok(llamada.args.includes('--escenarios'));
    assert.ok(!llamada.args.includes('--objetivo'));
  });

  test('sin RUN no ejecuta y lo dice', async () => {
    await assert.rejects(() => ejecutarMotor({}, { env: { EA_DATOS: d.datos } }), /define RUN/);
  });
});
