const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calculos.js');

// Datos inventados, chicos, para controlar cada cálculo a mano
const datos = {
  saltos: [
    { jugador: 'Ana', fecha: '2026-02-10', test: 'CMJ', intento: 1, altura: 40 },
    { jugador: 'Ana', fecha: '2026-02-10', test: 'CMJ', intento: 2, altura: 42 },
    { jugador: 'Ana', fecha: '2026-06-16', test: 'CMJ', intento: 1, altura: 37.8 },
    { jugador: 'Ana', fecha: '2026-02-10', test: 'CMJ D', intento: 1, altura: 20 },
    { jugador: 'Ana', fecha: '2026-02-10', test: 'CMJ I', intento: 1, altura: 25 },
    { jugador: 'Beto', fecha: '2026-02-10', test: 'CMJ', intento: 1, altura: 30 },
    { jugador: 'Beto', fecha: '2026-06-16', test: 'CMJ', intento: 1, altura: 33 },
    { jugador: 'Caro', fecha: '2026-06-16', test: 'CMJ', intento: 1, altura: 35 },
  ],
  ift: [
    { jugador: 'Ana', fecha: '2026-02-05', vift: 16 },
    { jugador: 'Ana', fecha: '2026-06-16', vift: 20 },
    { jugador: 'Beto', fecha: '2026-02-05', vift: 18 },
  ],
  encoder: [
    { jugador: 'Ana', fecha: '2026-02-06', ejercicio: 'Press plano', carga: 60, vmp: 0.8 },
    { jugador: 'Ana', fecha: '2026-04-10', ejercicio: 'Press plano', carga: 60, vmp: 0.9 },
    { jugador: 'Ana', fecha: '2026-06-17', ejercicio: 'Press plano', carga: 60, vmp: 0.84 },
    { jugador: 'Ana', fecha: '2026-06-17', ejercicio: 'Press plano', carga: 70, vmp: null },
  ],
};
const M = C.preparar(datos);

test('una evaluación es un mes y se nombra en castellano', () => {
  assert.deepEqual(M.periodos, ['2026-02', '2026-04', '2026-06']);
  assert.equal(M.nombrePeriodo['2026-06'], 'Junio');
  assert.equal(C.nombresDePeriodos(['2026-11', '2027-02'])['2027-02'], 'Febrero 2027');
});

test('se usa el mejor intento de cada salto', () => {
  const a = M.mejores.find((r) => r.jugador === 'Ana' && r.test === 'CMJ' && r.periodo === '2026-02');
  assert.equal(a.altura, 42);
});

test('asimetría = diferencia sobre la pierna más fuerte', () => {
  assert.equal(M.asimetrias[0].asimetria, 20); // |20 − 25| / 25
});

test('el cambio compara primera y última evaluación con los mismos jugadores', () => {
  const cmj = M.equipo.find((r) => r.indicador === 'Salto CMJ');
  assert.equal(cmj.jugadores, 2); // Caro no tiene febrero
  assert.equal(cmj.antes, 36);
  assert.equal(cmj.despues, 35.4);
  assert.equal(cmj.cambio, -1.7);
  assert.equal(cmj.mejoraron, 1);
  const press = M.cambios.find((r) => r.indicador === 'Press plano 60 kg');
  assert.equal(press.desde, '2026-02');
  assert.equal(press.hasta, '2026-06'); // abril queda en el medio
  assert.equal(press.cambio, 5);
});

test('para observar: bajas de 5 % o más y asimetrías de 15 % o más', () => {
  const tipos = M.alertas.map((r) => `${r.jugador}|${r.tipo}|${r.indicador}`);
  assert.ok(tipos.includes('Ana|Bajó|Salto CMJ')); // 42 → 37,8 = −10 %
  assert.ok(tipos.includes('Ana|Asimetría entre piernas|CMJ a una pierna'));
  assert.ok(!tipos.some((t) => t.startsWith('Beto')));
});

test('los valores "A revisar" (vmp vacía) no entran', () => {
  assert.ok(!M.encoder.some((r) => r.carga === 70));
});

test('distancias: metros por pasada y canchas de 28 m', () => {
  assert.deepEqual(C.distancia(22.5, 90, 30), { velocidad: 20.3, metros: 169, canchas: 6, resto: 1 });
  assert.deepEqual(C.distancia(20, 100, 10), { velocidad: 20, metros: 56, canchas: 2, resto: 0 });
});

test('la VIFT para entrenar es la última de cada jugador', () => {
  assert.equal(M.vift.get('Ana').valor, 20);
  assert.equal(M.vift.get('Beto').periodo, '2026-02');
});

test('puestos en el plantel', () => {
  const p = M.posiciones.find((r) => r.indicador === 'Salto CMJ' && r.periodo === '2026-06' && r.jugador === 'Ana');
  assert.deepEqual([p.puesto, p.de], [1, 3]);
});

test('sin datos no se rompe', () => {
  const v = C.preparar({});
  assert.deepEqual(v.equipo, []);
  assert.deepEqual(v.alertas, []);
});
