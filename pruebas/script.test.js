const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../apps-script/Codigo.gs');

test('encuentra columnas sin importar tildes ni mayúsculas', () => {
  assert.equal(S.columna_(['Jugador', 'Fecha', 'Altura limpia (cm)'], ['altura limpia']), 2);
  assert.equal(S.columna_(['JUGADOR'], ['Jugador']), 0);
  assert.equal(S.columna_(['Otra'], ['Jugador']), -1);
});

test('lee números con coma o punto', () => {
  assert.equal(S.numero_('2,75'), 2.75);
  assert.equal(S.numero_(38.5), 38.5);
  assert.equal(S.numero_(''), null);
  assert.equal(S.numero_('A revisar'), null);
});

test('lee fechas de la planilla y en texto', () => {
  assert.equal(S.fecha_('10/02/26'), '2026-02-10');
  assert.equal(S.fecha_('5/6/2026'), '2026-06-05');
  assert.equal(S.fecha_('El VO2max se calcula...'), null);
});

test('Saltos: usa la altura limpia y saltea los excluidos', () => {
  const filas = [
    ['Jugador', 'Fecha', 'Test', 'Intento', 'Tiempo vuelo (original)', 'Altura original (cm)', 'Altura limpia (cm)', 'Estado', 'Nota'],
    ['Lucas  Nanzer', '10/02/26', 'CMJ I', '2', '', '198,6', '19,6', 'Corregido', 'nota'],
    ['Otro', '10/02/26', 'CMJ', '1', '', '30', '30', 'Excluido', ''],
  ];
  assert.deepEqual(S.leerSaltos_(filas), [{ jugador: 'Lucas Nanzer', fecha: '2026-02-10', test: 'CMJ I', intento: 2, altura: 19.6 }]);
});

test('IFT: ignora filas sin VIFT y notas al pie', () => {
  const filas = [
    ['Jugador', 'Fecha', 'VIFT (km/h)', 'VO2 original (MAL)'],
    ['Bruno', '05/02/26', '12,5', '265'],
    ['Franco', '05/02/26', '', ''],
    [],
    ['El VO2max se calcula solo...'],
  ];
  assert.deepEqual(S.leerIft_(filas), [{ jugador: 'Bruno', fecha: '2026-02-05', vift: 12.5 }]);
});

test('Encoder: los "A revisar" llegan sin velocidad', () => {
  const filas = [
    ['Jugador', 'Fecha', 'Ejercicio', 'Carga (kg)', 'VMP original (m/s)', 'VMP limpia (m/s)', 'Estado', 'Nota', 'VMP para resumen'],
    ['Ana', '17/02/26', 'Sentadilla media', '80', '0,76', '0,76', 'OK', '', '0,76'],
    ['Ana', '17/02/26', 'Sentadilla media', '90', '0,8', '0,8', 'A revisar', 'x', ''],
  ];
  const r = S.leerEncoder_(filas);
  assert.equal(r[0].vmp, 0.76);
  assert.equal(r[1].vmp, null);
});

test('si falta una columna avisa', () => {
  assert.throws(() => S.leerIft_([['Jugador', 'Fecha']]), /VIFT/);
});
