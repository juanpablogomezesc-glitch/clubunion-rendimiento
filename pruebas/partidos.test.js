const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/partidos.js');

const fila = (o) => ({ fecha: '2026-10-26', rival: 'Rival', local: true, titular: false, minutos: 0, puntos: 0, t2c: 0, t2i: 0, t3c: 0, t3i: 0, tlc: 0, tli: 0,
  rebDef: 0, rebOf: 0, rebTot: 0, asistencias: 0, recuperos: 0, perdidas: 0, tapas: 0, faltas: 0, valoracion: 0, masMenos: 0, puntosEquipo: 63, puntosRival: 86, ...o });
const est = [
  fila({ jugador: 'Ana', titular: true, minutos: 30, puntos: 20, t2c: 4, t2i: 8, t3c: 3, t3i: 6, tlc: 3, tli: 4, rebTot: 5 }),
  fila({ jugador: 'Beto', minutos: 10, puntos: 2, t2c: 1, t2i: 4, rebTot: 3 }),
  fila({ jugador: 'Caro', minutos: 0 }),
  fila({ fecha: '2026-11-08', rival: 'Otro', puntosEquipo: 70, puntosRival: 65, jugador: 'Ana', minutos: 20, puntos: 10, t2c: 5, t2i: 6, rebTot: 1 }),
];

test('partidos: el más nuevo primero, con resultado y totales', () => {
  const ps = P.partidos(est);
  assert.deepEqual(ps.map((p) => [p.fecha, p.resultado]), [['2026-11-08', 'Ganó'], ['2026-10-26', 'Perdió']]);
  const p = ps[1];
  assert.deepEqual([p.puntosEquipo, p.puntosRival, p.totales.t2c, p.totales.t2i, p.totales.p2, p.totales.p3], [63, 86, 5, 12, 42, 50]);
  assert.deepEqual(p.jugadores.map((j) => j.jugador), ['Ana', 'Beto', 'Caro']);
});

test('promedios por partido jugado (sin contar los que no entraron)', () => {
  const pr = P.promedios(est);
  const ana = pr.find((r) => r.jugador === 'Ana'), caro = pr.find((r) => r.jugador === 'Caro');
  assert.deepEqual([ana.jugados, ana.minutos, ana.puntos, ana.rebotes, ana.p2, ana.t2], [2, 25, 15, 3, 64, '9/14']);
  assert.deepEqual([caro.convocado, caro.jugados, caro.minutos], [1, 0, null]);
  assert.equal(pr[0].jugador, 'Ana'); // ordenado por minutos
});

test('sin estadísticas no se rompe', () => {
  assert.deepEqual(P.partidos([]), []);
  assert.deepEqual(P.promedios(undefined), []);
});

test('un partido con la fecha a confirmar lo indica, con su archivo', () => {
  const p = P.partidos([fila({ jugador: 'Ana', minutos: 10, fechaDudosa: true, archivo: 'abc' })])[0];
  assert.deepEqual([p.fechaDudosa, p.archivo], [true, 'abc']);
});

test('U21: un partido sin rebotes ni intentos no cuenta para porcentajes y se separa por planilla', () => {
  const u21 = (o) => fila({ categoria: 'U21', fecha: '2026-11-01', rival: 'Sanjustino', ...o });
  const e = [
    ...est,
    u21({ archivo: 'a', jugador: 'Ana', minutos: 30, puntos: 10, t2c: 5, t2i: 5, tlc: 0, tli: 2 }),
    u21({ archivo: 'b', jugador: 'Ana', minutos: 20, puntos: 6, t2c: 3, t2i: 3 }), // mismo rival y fecha, otro partido
  ];
  const ps = P.partidos(e);
  assert.equal(ps.filter((p) => p.rival === 'Sanjustino').length, 2);
  assert.equal(ps.find((p) => p.id === 'a').completo, false);
  const todas = P.promedios(e).find((r) => r.jugador === 'Ana');
  assert.equal(todas.jugados, 4);
  assert.equal(todas.p2, 64); // solo de los partidos completos (9/14)
  assert.equal(todas.ptl, 50); // libres de todos (3/6)
  const soloU21 = P.promedios(e, 'U21').find((r) => r.jugador === 'Ana');
  assert.deepEqual([soloU21.jugados, soloU21.puntos, soloU21.p2, soloU21.rebotes], [2, 8, null, null]);
});
