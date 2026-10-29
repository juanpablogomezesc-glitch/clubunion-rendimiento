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

const fs = require('fs');
const planilla = fs.readFileSync(require('path').join(__dirname, 'fixtures/planilla-cap.txt'), 'utf8');

test('planilla de la CAP: equipos, rival y solo las filas de Unión', () => {
  const p = S.parsearPlanilla_(planilla, 'UNION DE SANTO TOME');
  assert.deepEqual(p.equipos, ['UNION DE SANTO TOME', 'EQUIPO RIVAL DE PRUEBA']);
  assert.equal(p.rival, 'EQUIPO RIVAL DE PRUEBA');
  assert.equal(p.local, true);
  assert.equal(p.jugadores.length, 6);
  const [a, b] = p.jugadores;
  assert.deepEqual([a.nombre, a.titular, a.minutos, a.puntos, a.t2c, a.t2i, a.t3c, a.t3i, a.tlc, a.tli, a.rebTot, a.valoracion, a.masMenos],
    ['PEREZ, JUAN', true, 37.5, 26, 4, 11, 4, 7, 6, 10, 5, 16, 19]);
  assert.equal(b.titular, false);
  assert.equal(b.masMenos, -15);
  const cap = p.jugadores.find((j) => j.capitan);
  assert.equal(cap.nombre, 'LOPEZ, MIGUEL ANGEL');
  assert.equal(p.jugadores[5].minutos, 0);
});

test('planilla de la CAP: también con los asteriscos escapados y Unión de visitante', () => {
  const visitante = planilla.replace(/\*/g, '\\*')
    .replace('Estadísticas UNION DE SANTO TOME vs EQUIPO RIVAL DE PRUEBA', 'Estadísticas EQUIPO RIVAL DE PRUEBA vs UNION DE SANTO TOME');
  // en la planilla de visitante, el primer bloque es el del local
  const bloques = visitante.split(/\n(?=EQUIPO RIVAL DE PRUEBA\n\nEntrenador)/);
  const union = bloques[0].slice(bloques[0].indexOf('UNION DE SANTO TOME\n\nEntrenador'), bloques[0].lastIndexOf('TOTALES'));
  const totalesU = bloques[0].slice(bloques[0].lastIndexOf('TOTALES')).split('\n')[0];
  const rival = bloques[1].slice(0, bloques[1].indexOf('CONFEDER'));
  const cabecera = bloques[0].slice(0, bloques[0].indexOf('UNION DE SANTO TOME\n\nEntrenador'));
  const texto = cabecera + rival.replace('UNION DE SANTO TOME', '') + '\n\n' + union + totalesU + '\n\nCONFEDERACIÓN';
  const p = S.parsearPlanilla_(texto, 'UNION DE SANTO TOME');
  assert.equal(p.local, false);
  assert.equal(p.rival, 'EQUIPO RIVAL DE PRUEBA');
  assert.equal(p.jugadores.length, 6);
  assert.equal(p.jugadores[0].titular, true);
});

test('nombres de la CAP contra el plantel', () => {
  const plantel = ['Leandro Durizotto', 'Lucas Nanzer', 'Miyen Federico Godoy', 'Marcos Quinteros', 'Juan Sebastián Varoni', 'Tomás Peralta', 'Franco Peralta'];
  assert.equal(S.emparejar_('DURIZOTTO, LEANDRO IVALDI', plantel, {}), 'Leandro Durizotto');
  assert.equal(S.emparejar_('NANZER, LUCA SALVADOR', plantel, {}), 'Lucas Nanzer');
  assert.equal(S.emparejar_('GODOY, MIYEN FEDERICO', plantel, {}), 'Miyen Federico Godoy');
  assert.equal(S.emparejar_('VARONI, JUAN SEBASTIAN', plantel, {}), 'Juan Sebastián Varoni');
  assert.equal(S.emparejar_('PERALTA, TOMAS', plantel, {}), 'Tomás Peralta'); // dos Peralta: decide el nombre
  assert.equal(S.emparejar_('LEONI, TOMAS', plantel, {}), null);
  assert.equal(S.emparejar_('BARONI, JUANSE', plantel, { 'baroni, juanse': 'Juan Sebastián Varoni' }), 'Juan Sebastián Varoni');
  assert.equal(S.nombreNuevo_('WELSCHEN, SANTINO'), 'Santino Welschen');
});

test('fecha del partido: el último "Partido" de Sesiones en la semana antes de subir el PDF', () => {
  assert.equal(S.fechaPartido_('2026-10-29', ['2026-10-18', '2026-10-25'], new Set()), '2026-10-25');
  assert.equal(S.fechaPartido_('2026-10-29', ['2026-10-18', '2026-10-25'], new Set(['2026-10-25'])), null);
  assert.equal(S.fechaPartido_('2026-10-29', [], new Set()), null);
});
