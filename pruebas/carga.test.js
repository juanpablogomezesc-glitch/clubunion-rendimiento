const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/carga.js');

test('semanas de lunes a domingo', () => {
  assert.equal(K.lunes('2026-11-01'), '2026-10-26'); // domingo
  assert.equal(K.lunes('2026-11-02'), '2026-11-02'); // lunes
});

test('carga = RPE × minutos; en partido, los minutos que jugó', () => {
  const r = K.registros({
    sesiones: [{ fecha: '2026-11-02', tipo: 'Entrenamiento', duracion: 90 }, { fecha: '2026-11-07', tipo: 'Partido', duracion: 120 }],
    partidos: [{ fecha: '2026-11-07', rival: 'Colón', jugador: 'Ana', minutos: 30 }],
    rpe: [
      { fecha: '2026-11-02', jugador: 'Ana', tipo: 'Entrenamiento', rpe: 5 },
      { fecha: '2026-11-02', jugador: 'Ana', tipo: 'Entrenamiento', rpe: 6 }, // respondió dos veces: vale la última
      { fecha: '2026-11-07', jugador: 'Ana', tipo: 'Partido', rpe: 8 },
      { fecha: '2026-11-07', jugador: 'Beto', tipo: 'Partido', rpe: 4 }, // no está en Partidos: usa la duración
      { fecha: '2026-11-09', jugador: 'Ana', tipo: 'Gimnasio', rpe: 5 }, // sin sesión cargada: sin carga
    ],
  });
  assert.deepEqual(r.map((x) => [x.jugador, x.fecha, x.carga]), [
    ['Ana', '2026-11-02', 540], ['Ana', '2026-11-07', 240], ['Beto', '2026-11-07', 480], ['Ana', '2026-11-09', null],
  ]);
});

// 5 semanas de la misma carga y una última semana el doble
function semanas(n, factorUltima) {
  const sesiones = [], rpe = [];
  for (let s = 0; s < n; s++) {
    for (const d of [0, 2, 4]) {
      const fecha = K.sumarDias('2026-09-28', 7 * s + d);
      sesiones.push({ fecha, tipo: 'Entrenamiento', duracion: 60 });
      rpe.push({ fecha, jugador: 'Ana', tipo: 'Entrenamiento', rpe: s === n - 1 ? 5 * factorUltima : 5 });
    }
  }
  return { sesiones, partidos: [], rpe, plantel: ['Ana', 'Beto'] };
}

test('relación aguda:crónica', () => {
  const m = K.preparar(semanas(5, 2), '2026-11-01');
  const ana = m.jugadores.find((j) => j.jugador === 'Ana');
  assert.equal(ana.aguda, 1800);   // 3 × 60 × 10
  assert.equal(ana.cronica, 900);  // 3 × 60 × 5 por semana
  assert.equal(ana.relacion, 2);
  assert.equal(ana.estado.nombre, 'Muy alta');
  assert.equal(m.carga7, 1800);
  assert.equal(m.cambio7, 100);
});

test('sin 3 semanas previas no se calcula la relación', () => {
  const m = K.preparar(semanas(2, 1), '2026-10-11');
  assert.equal(m.jugadores.find((j) => j.jugador === 'Ana').relacion, null);
});

test('cumplimiento del formulario', () => {
  const m = K.preparar(semanas(2, 1), '2026-10-11'); // 6 sesiones, 2 jugadores, solo Ana responde
  assert.equal(m.cumplimiento, 50);
});

test('minutos de partido', () => {
  const m = K.preparar({ sesiones: [], rpe: [], plantel: ['Ana'], partidos: [
    { fecha: '2026-10-03', rival: 'Banco', jugador: 'Ana', minutos: 20 },
    { fecha: '2026-10-10', rival: 'Colón', jugador: 'Ana', minutos: 30 },
    { fecha: '2026-10-17', rival: 'Gimnasia', jugador: 'Ana', minutos: 0 },
  ] }, '2026-10-18');
  const ana = m.jugadores[0];
  assert.deepEqual([ana.minutosTotal, ana.partidosJugados, ana.minutosPromedio, ana.ultimoPartido.rival], [50, 2, 25, 'Gimnasia']);
  assert.deepEqual(m.ultimoPartido, { fecha: '2026-10-17', rival: 'Gimnasia', jugaron: 0 });
});

test('sin datos o con error de la planilla no se rompe', () => {
  assert.equal(K.preparar(undefined, '2026-10-18').vacio, true);
  assert.equal(K.preparar({ error: 'x' }, '2026-10-18').error, 'x');
  assert.equal(K.preparar({ sesiones: [], partidos: [], rpe: [], plantel: [] }, '2026-10-18').vacio, true);
});
