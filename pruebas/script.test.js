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

test('Sesiones: fecha, tipo y duración', () => {
  const filas = [['Fecha', 'Tipo', 'Duración (min)', 'Nota'], ['03/11/2026', 'Entrenamiento', 90, ''], ['04/11/2026', 'Gimnasio', '', 'sin cargar']];
  assert.deepEqual(S.leerSesiones_(filas), [{ fecha: '2026-11-03', tipo: 'Entrenamiento', duracion: 90 }]);
});

test('Partidos: una columna por jugador, vacío = no jugó', () => {
  const filas = [['Fecha', 'Rival', 'Ana', 'Beto'], ['08/11/2026', 'Colón', 32, ''], ['15/11/2026', 'Gimnasia', 0, 18]];
  assert.deepEqual(S.leerPartidos_(filas), [
    { fecha: '2026-11-08', rival: 'Colón', jugador: 'Ana', minutos: 32 },
    { fecha: '2026-11-15', rival: 'Gimnasia', jugador: 'Ana', minutos: 0 },
    { fecha: '2026-11-15', rival: 'Gimnasia', jugador: 'Beto', minutos: 18 },
  ]);
});

test('RPE: toma el número de la opción y la fecha de la sesión si la completaron', () => {
  assert.equal(S.rpe_('7 – Muy duro'), 7);
  assert.equal(S.rpe_('10 – Máximo'), 10);
  assert.equal(S.rpe_('Nada'), null);
  const filas = [['Marca temporal', 'Jugador', 'Sesión', 'Esfuerzo (RPE)', 'Fecha de la sesión'],
    [new Date('2026-11-03T22:00:00Z'), 'Ana', 'Entrenamiento', '6', ''],
    [new Date('2026-11-04T12:00:00Z'), 'Beto', 'Partido', '8', '02/11/2026']];
  const r = S.leerRpe_(filas);
  assert.equal(r[0].fecha, '2026-11-03');
  assert.equal(r[1].fecha, '2026-11-02');
  assert.equal(r[1].rpe, 8);
});
