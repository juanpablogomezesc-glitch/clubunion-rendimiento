/**
 * Rendimiento · Club Unión de Santo Tomé — script de la planilla
 *
 * Lee las pestañas Saltos, IFT y Encoder de la planilla "DATOS PRIMERA - LIMPIO" y se las entrega a la página
 * a quien tenga una clave de la pestaña "Accesos". Quien no tiene el link con la clave no ve nada.
 * Solo devuelve jugador, fecha, test y valor: nada de la hoja Plantel (nacimiento, peso) ni notas.
 *
 * Va pegado en Extensiones > Apps Script de esa misma planilla. Ver INSTRUCCIONES.md.
 */

// ====== OPCIONES ======
const PAGINA = 'https://juanpablogomezesc-glitch.github.io/clubunion-rendimiento/'; // dónde está la página
const SEGUNDOS_EN_MEMORIA = 300;            // una consulta repetida en 5 minutos no vuelve a leer la planilla
const SEGUNDOS_MINIMOS_ENTRE_LECTURAS = 30; // el botón "Actualizar" no lee la planilla más de una vez cada 30 segundos
const ID_CARGA = '1I0zUBZIcicYVUmd854eoCoBwNfNuO-43VO1zoi0cPyQ'; // planilla "CARGA PRIMERA" (sesiones, partidos y RPE)
const CARPETA_PDF = '1WmIe9vu4_c6YkQMtrkreMwSKis__Nq1K';  // carpeta "Planillas de partido (PDF)"
const EQUIPO = 'UNION DE SANTO TOME';                       // cómo figura el club en la planilla de la CAP
// ======================

const HOJA_ACCESOS = 'Accesos';
const COLUMNAS_ACCESOS = ['Nombre', 'Clave', 'Link'];
const LETRAS_CLAVE = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CLAVE = 24;

// ---------- Lectura (funciones puras, probadas con Node en pruebas/script.test.js) ----------

const normalizar_ = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Busca la columna cuyo título empieza con alguno de los textos dados (sin importar tildes ni mayúsculas). */
function columna_(titulos, opciones) {
  const ts = titulos.map(normalizar_);
  for (const o of opciones) {
    const i = ts.findIndex((t) => t.startsWith(normalizar_(o)));
    if (i >= 0) return i;
  }
  return -1;
}

/** 2,75 / "2,75" / "2.75" → 2.75 · vacío o texto → null */
function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const t = String(v == null ? '' : v).trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Fecha de la celda → "AAAA-MM-DD". Acepta fechas de la planilla y textos "10/02/26" o "10/02/2026". */
function fecha_(v, zona) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return typeof Utilities !== 'undefined' ? Utilities.formatDate(v, zona || 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') : v.toISOString().slice(0, 10);
  }
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/.exec(String(v == null ? '' : v));
  if (!m) return null;
  const anio = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const excluido_ = (estado) => normalizar_(estado) === 'excluido';
const nombre_ = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

/** Pestaña Saltos → [{ jugador, fecha, test, intento, altura }] (usa la "Altura limpia"). */
function leerSaltos_(filas, zona) {
  const t = filas[0] || [];
  const c = { j: columna_(t, ['Jugador']), f: columna_(t, ['Fecha']), test: columna_(t, ['Test']), i: columna_(t, ['Intento']), h: columna_(t, ['Altura limpia']), e: columna_(t, ['Estado']) };
  if (c.j < 0 || c.f < 0 || c.test < 0 || c.h < 0) throw new Error('La pestaña Saltos no tiene las columnas Jugador, Fecha, Test y Altura limpia.');
  const out = [];
  for (const f of filas.slice(1)) {
    const jugador = nombre_(f[c.j]), fecha = fecha_(f[c.f], zona), altura = numero_(f[c.h]);
    if (!jugador || !fecha || altura == null || altura <= 0 || (c.e >= 0 && excluido_(f[c.e]))) continue;
    out.push({ jugador, fecha, test: nombre_(f[c.test]), intento: c.i >= 0 ? numero_(f[c.i]) : null, altura });
  }
  return out;
}

/** Pestaña IFT → [{ jugador, fecha, vift }] */
function leerIft_(filas, zona) {
  const t = filas[0] || [];
  const c = { j: columna_(t, ['Jugador']), f: columna_(t, ['Fecha']), v: columna_(t, ['VIFT']) };
  if (c.j < 0 || c.f < 0 || c.v < 0) throw new Error('La pestaña IFT no tiene las columnas Jugador, Fecha y VIFT.');
  const out = [];
  for (const f of filas.slice(1)) {
    const jugador = nombre_(f[c.j]), fecha = fecha_(f[c.f], zona), vift = numero_(f[c.v]);
    if (!jugador || !fecha || vift == null || vift <= 0) continue;
    out.push({ jugador, fecha, vift });
  }
  return out;
}

/** Pestaña Encoder → [{ jugador, fecha, ejercicio, carga, vmp }] (vmp de "VMP para resumen": vacía si está "A revisar"). */
function leerEncoder_(filas, zona) {
  const t = filas[0] || [];
  const c = { j: columna_(t, ['Jugador']), f: columna_(t, ['Fecha']), ej: columna_(t, ['Ejercicio']), k: columna_(t, ['Carga']), v: columna_(t, ['VMP para resumen', 'VMP limpia']), e: columna_(t, ['Estado']) };
  if (c.j < 0 || c.f < 0 || c.ej < 0 || c.k < 0 || c.v < 0) throw new Error('La pestaña Encoder no tiene las columnas Jugador, Fecha, Ejercicio, Carga y VMP para resumen.');
  const out = [];
  for (const f of filas.slice(1)) {
    const jugador = nombre_(f[c.j]), fecha = fecha_(f[c.f], zona), carga = numero_(f[c.k]);
    if (!jugador || !fecha || carga == null || (c.e >= 0 && excluido_(f[c.e]))) continue;
    const vmp = numero_(f[c.v]);
    out.push({ jugador, fecha, ejercicio: nombre_(f[c.ej]), carga, vmp: vmp != null && vmp > 0 ? vmp : null });
  }
  return out;
}

/** Pestaña Sesiones → [{ fecha, tipo, duracion }] (una fila por sesión del equipo). */
function leerSesiones_(filas, zona) {
  const t = filas[0] || [];
  const c = { f: columna_(t, ['Fecha']), t: columna_(t, ['Tipo']), d: columna_(t, ['Duracion', 'Duración']) };
  if (c.f < 0 || c.t < 0 || c.d < 0) throw new Error('La pestaña Sesiones no tiene las columnas Fecha, Tipo y Duración.');
  const out = [];
  for (const f of filas.slice(1)) {
    const fecha = fecha_(f[c.f], zona), duracion = numero_(f[c.d]);
    if (!fecha || duracion == null || duracion <= 0) continue;
    out.push({ fecha, tipo: nombre_(f[c.t]) || 'Entrenamiento', duracion });
  }
  return out;
}

/** Pestaña Partidos (una columna por jugador) → [{ fecha, rival, jugador, minutos }]. Vacío = no jugó. */
function leerPartidos_(filas, zona) {
  const t = filas[0] || [];
  const cf = columna_(t, ['Fecha']), cr = columna_(t, ['Rival']);
  if (cf < 0) throw new Error('La pestaña Partidos no tiene la columna Fecha.');
  const jugadores = t.map((n, i) => (i === cf || i === cr || !nombre_(n) ? null : nombre_(n)));
  const out = [];
  for (const f of filas.slice(1)) {
    const fecha = fecha_(f[cf], zona);
    if (!fecha) continue;
    jugadores.forEach((jugador, i) => {
      const minutos = jugador ? numero_(f[i]) : null;
      if (jugador && minutos != null) out.push({ fecha, rival: cr >= 0 ? nombre_(f[cr]) : '', jugador, minutos });
    });
  }
  return out;
}

/** "7 – Muy duro" / 7 → 7 */
function rpe_(v) {
  if (typeof v === 'number') return v >= 0 && v <= 10 ? v : null;
  const m = /^\s*(\d{1,2})/.exec(String(v == null ? '' : v));
  return m && +m[1] <= 10 ? +m[1] : null;
}

/** Respuestas del formulario → [{ fecha, jugador, tipo, rpe }]. Usa "Fecha de la sesión" si la completaron, si no el día de la respuesta. */
function leerRpe_(filas, zona) {
  const t = filas[0] || [];
  const c = { m: columna_(t, ['Marca temporal', 'Timestamp']), j: columna_(t, ['Jugador']), t: columna_(t, ['Sesion', 'Sesión']), r: columna_(t, ['Esfuerzo', 'RPE']), f: columna_(t, ['Fecha de la sesion', 'Fecha de la sesión']) };
  if (c.j < 0 || c.r < 0) throw new Error('Las respuestas del formulario no tienen las preguntas Jugador y Esfuerzo.');
  const out = [];
  for (const f of filas.slice(1)) {
    const jugador = nombre_(f[c.j]), rpe = rpe_(f[c.r]);
    const fecha = (c.f >= 0 && fecha_(f[c.f], zona)) || (c.m >= 0 && fecha_(f[c.m], zona));
    if (!jugador || rpe == null || !fecha) continue;
    out.push({ fecha, jugador, tipo: c.t >= 0 ? nombre_(f[c.t]) || 'Entrenamiento' : 'Entrenamiento', rpe });
  }
  return out;
}

// ---------- Planillas de partido de la CAP (PDF) ----------

/** "4/11" → [4, 11] */
const convertidos_ = (v) => String(v).split('/').map(Number);

/**
 * Texto de la planilla de estadísticas de la CAP → equipos, rival y la fila de cada jugador de EQUIPO.
 * Cada fila: número, * si fue titular, "APELLIDO, NOMBRE", minutos (mm:ss) y 19 valores.
 */
function parsearPlanilla_(texto, equipo) {
  equipo = normalizar_(equipo || EQUIPO);
  // La CAP escribe los negativos con un guion invisible (U+00AD) y a veces Docs usa "−" o "–": todo pasa a "-".
  // El título de la columna "+/-" a veces queda en medio de la primera fila: se saca.
  const t = String(texto || '').replace(/\\\*/g, '*').replace(/[\u00ad\u2212\u2013\u2014]/g, '-')
    .replace(/\+\/-?/g, ' ').replace(/\s+/g, ' ');
  const entrenadores = [];
  for (let i = t.indexOf('Entrenador:'); i >= 0; i = t.indexOf('Entrenador:', i + 1)) entrenadores.push(i);
  const FILA = /(\d{1,2}) (\*?)([^\d:,]+,[^\d:]+?) (\d{1,3}):(\d{2})((?: [-+]?\d+(?:\/\d+)?){19})/g;
  const filas = [];
  for (let m; (m = FILA.exec(t));) filas.push({ pos: m.index, m });
  // nombres de los equipos: el primero sale del título, el segundo está entre los TOTALES del primero y su "Entrenador:"
  const titulo = /Estad[ií]sticas ((?:(?!Estad[ií]sticas).)+?) vs /.exec(t);
  const totales = /TOTALES \d{1,3}:\d{2}(?: [-+]?\d+(?:\/\d+)?){19}/.exec(t);
  const limpiar = (x) => x.replace(/^[-\s]+|[-\s]+$/g, '');
  // en el PDF original el título separa con guiones: "Estadísticas - LOCAL vs VISITANTE - torneo"
  const ambos = /Estad[ií]sticas[ -]*((?:(?!Estad[ií]sticas).)+?) vs (.+?) - /.exec(t);
  const equipos = ambos ? [limpiar(ambos[1]), limpiar(ambos[2])]
    : [titulo ? limpiar(titulo[1]) : '', totales && entrenadores[1] ? limpiar(t.slice(totales.index + totales[0].length, entrenadores[1])) : ''];
  const propio = equipos.findIndex((e) => normalizar_(e).indexOf(equipo) >= 0);
  if (propio < 0 || !entrenadores[propio]) return { equipos, rival: '', local: null, jugadores: [] };
  const desde = entrenadores[propio], hasta = entrenadores[propio + 1] || t.length;
  const jugadores = filas.filter((f) => f.pos > desde && f.pos < hasta).map(({ m }) => {
    const v = m[6].trim().split(' ');
    const [c2, i2] = convertidos_(v[1]), [c3, i3] = convertidos_(v[3]), [cl, il] = convertidos_(v[5]);
    return {
      numero: +m[1], titular: m[2] === '*', capitan: /\(CAP\)/i.test(m[3]),
      nombre: m[3].replace(/\(CAP\)/i, '').trim(),
      minutos: Math.round((+m[4] + +m[5] / 60) * 10) / 10,
      puntos: +v[0], t2c: c2, t2i: i2, t3c: c3, t3i: i3, tlc: cl, tli: il,
      rebDef: +v[7], rebOf: +v[8], rebTot: +v[9], asistencias: +v[10], recuperos: +v[11], perdidas: +v[12],
      tapas: +v[13], tapasRecibidas: +v[14], faltas: +v[15], faltasRecibidas: +v[16], valoracion: +v[17], masMenos: +v[18],
    };
  });
  return { equipos, rival: equipos[1 - propio], local: propio === 0, jugadores };
}

/** "DURIZOTTO, LEANDRO IVALDI" → "Leandro Durizotto" del plantel. Primero la tabla de equivalencias, después apellido + nombre. */
function emparejar_(nombreCap, plantel, equivalencias) {
  const n = normalizar_(nombreCap);
  if (equivalencias && equivalencias[n]) return equivalencias[n];
  const palabras = (x) => normalizar_(x).replace(/[^a-z ]/g, ' ').split(' ').filter(Boolean);
  const [ap, nom] = n.split(',');
  const aps = palabras(ap || ''), noms = palabras(nom || '');
  const mismos = plantel.filter((j) => { const w = palabras(j); return aps.length && aps.every((a) => w.includes(a)); });
  const conNombre = mismos.filter((j) => noms.length && palabras(j).some((w) => !aps.includes(w) && w.slice(0, 3) === noms[0].slice(0, 3)));
  if (conNombre.length === 1) return conNombre[0];
  if (mismos.length === 1) return mismos[0];
  return null;
}

/** "LEONI, TOMAS" → "Tomas Leoni" (para un jugador que no estaba en el plantel). */
function nombreNuevo_(nombreCap) {
  const titulo = (x) => x.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).trim();
  const [ap, nom] = String(nombreCap).split(',');
  return [titulo((nom || '').trim().split(/\s+/)[0] || ''), titulo(ap || '')].filter(Boolean).join(' ');
}

/**
 * Sesiones que faltan en la pestaña Sesiones: un día y tipo con respuestas del formulario y sin fila propia.
 * existentes: claves "AAAA-MM-DD|Tipo" de las filas que ya están (aunque no tengan duración).
 */
function sesionesFaltantes_(existentes, rpe, duraciones) {
  const ya = new Set(existentes), out = [];
  for (const r of rpe) {
    const k = r.fecha + '|' + r.tipo;
    if (ya.has(k)) continue;
    ya.add(k);
    out.push({ fecha: r.fecha, tipo: r.tipo, duracion: duraciones[r.tipo] || duraciones.Otro || 60 });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** La planilla no trae la fecha: es la del último "Partido" de Sesiones en la semana antes de subir el PDF. */
function fechaPartido_(subido, fechasPartido, usadas) {
  const d = new Date(subido + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 6);
  const desde = d.toISOString().slice(0, 10);
  const c = fechasPartido.filter((f) => f >= desde && f <= subido && !(usadas && usadas.has(f))).sort();
  return c.length ? c[c.length - 1] : null;
}

// ---------- Planilla ----------

function leerTodo_() {
  const ss = SpreadsheetApp.getActive();
  const zona = ss.getSpreadsheetTimeZone();
  const hoja = (n) => {
    const h = ss.getSheetByName(n);
    if (!h) throw new Error(`Falta la pestaña "${n}".`);
    return h.getDataRange().getValues();
  };
  return {
    saltos: leerSaltos_(hoja('Saltos'), zona),
    ift: leerIft_(hoja('IFT'), zona),
    encoder: leerEncoder_(hoja('Encoder'), zona),
    carga: leerCarga_(),
  };
}

/** Lee la planilla CARGA PRIMERA. Si falla, la página igual muestra las evaluaciones. */
function leerCarga_() {
  try {
    const ss = SpreadsheetApp.openById(ID_CARGA);
    const zona = ss.getSpreadsheetTimeZone();
    const valores = (h) => (h ? h.getDataRange().getValues() : [[]]);
    const respuestas = ss.getSheets().find((h) => /^respuestas/i.test(h.getName()));
    return {
      sesiones: leerSesiones_(valores(ss.getSheetByName('Sesiones')), zona),
      partidos: leerPartidos_(valores(ss.getSheetByName('Partidos')), zona),
      rpe: respuestas ? leerRpe_(valores(respuestas), zona) : [],
      plantel: valores(ss.getSheetByName('Plantel')).slice(1).filter((f) => nombre_(f[0]) && normalizar_(f[1]) !== 'no').map((f) => nombre_(f[0])),
      formulario: PropertiesService.getScriptProperties().getProperty('FORM_URL') || '',
    };
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
}

function clavesValidas_() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_ACCESOS);
  if (!h) return [];
  return h.getDataRange().getValues().slice(1).map((f) => String(f[1] || '').trim()).filter((c) => c.length >= 16);
}

// ---------- Web ----------

const responder_ = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.accion !== 'evaluaciones') return responder_({ ok: false, error: 'accion' });
    const clave = String(p.clave || '').trim();
    if (!clave || clavesValidas_().indexOf(clave) < 0) return responder_({ ok: false, error: 'clave' });

    const cache = CacheService.getScriptCache();
    const guardado = cache.get('evaluaciones');
    const reciente = cache.get('lectura-reciente');
    if (guardado && (!p.fresco || reciente)) return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);

    const texto = JSON.stringify({ ok: true, generado: new Date().toISOString(), datos: leerTodo_() });
    if (texto.length < 100000) cache.put('evaluaciones', texto, SEGUNDOS_EN_MEMORIA);
    cache.put('lectura-reciente', '1', SEGUNDOS_MINIMOS_ENTRE_LECTURAS);
    return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return responder_({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------- Para ejecutar a mano desde el editor ----------

/** Crea la pestaña "Accesos" (no toca las demás). */
function configurar() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA_ACCESOS);
  if (!h) {
    h = ss.insertSheet(HOJA_ACCESOS);
    h.getRange(1, 1, 1, COLUMNAS_ACCESOS.length).setValues([COLUMNAS_ACCESOS]).setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange(2, 1).setValue('Juampa');
    h.setColumnWidth(3, 520);
  }
  Logger.log('Listo: completá los nombres en la pestaña Accesos y ejecutá generarClaves.');
}

/** Completa la clave y el link de cada fila de "Accesos" que tenga nombre y no tenga clave. */
function generarClaves() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA_ACCESOS);
  if (!h) throw new Error('Primero ejecutá configurar.');
  const filas = h.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    const [nombre, clave] = filas[i];
    if (!String(nombre).trim()) continue;
    let c = String(clave || '').trim();
    if (!c) {
      c = Array.from({ length: LARGO_CLAVE }, () => LETRAS_CLAVE[Math.floor(Math.random() * LETRAS_CLAVE.length)]).join('');
      h.getRange(i + 1, 2).setValue(c);
    }
    h.getRange(i + 1, 3).setValue(`${PAGINA}?c=${c}`);
  }
}

// ---------- Lectura de los PDF de la CAP ----------

const TITULOS_ESTADISTICAS = ['Fecha', 'Rival', 'Condición', 'Jugador', 'Nombre en la planilla', 'Titular', 'Minutos', 'Puntos', '2P conv', '2P int', '3P conv', '3P int', 'TL conv', 'TL int', 'Reb def', 'Reb of', 'Reb tot', 'Asistencias', 'Recuperos', 'Pérdidas', 'Tapas', 'Tapas recibidas', 'Faltas', 'Faltas recibidas', 'Valoración', '+/-', 'Archivo', 'Nota'];

function hojaConTitulos_(ss, nombre, titulos) {
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, titulos.length).setValues([titulos]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

/** Convierte el PDF en texto con Google Docs (necesita el servicio "Drive API" activado en el editor). */
function textoDePdf_(archivo) {
  if (typeof Drive === 'undefined') throw new Error('Falta activar el servicio Drive API (ver INSTRUCCIONES.md).');
  const copia = Drive.Files.copy({ name: 'tmp ' + archivo.getName(), title: 'tmp ' + archivo.getName(), mimeType: MimeType.GOOGLE_DOCS }, archivo.getId());
  try {
    return DocumentApp.openById(copia.id).getBody().getText();
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);
  }
}

const DURACIONES_HABITUALES = [['Entrenamiento', 90], ['Gimnasio', 60], ['Partido', 120], ['Otro', 60]];

/**
 * Agrega a Sesiones los días que tienen respuestas del formulario y no tienen fila, con la duración habitual
 * de la pestaña "Ajustes". Una fila que ya está pero no tiene duración se completa con la habitual.
 */
function completarSesiones_(ss, zona) {
  const ajustes = hojaConTitulos_(ss, 'Ajustes', ['Tipo de sesión', 'Duración habitual (min)']);
  if (ajustes.getLastRow() < 2) ajustes.getRange(2, 1, DURACIONES_HABITUALES.length, 2).setValues(DURACIONES_HABITUALES);
  const duraciones = {};
  ajustes.getDataRange().getValues().slice(1).forEach((f) => { const d = numero_(f[1]); if (nombre_(f[0]) && d > 0) duraciones[nombre_(f[0])] = d; });

  const respuestas = ss.getSheets().find((h) => /^respuestas/i.test(h.getName()));
  if (!respuestas) return 0;
  const rpe = leerRpe_(respuestas.getDataRange().getValues(), zona);
  const hSes = ss.getSheetByName('Sesiones');
  const filas = hSes.getDataRange().getValues();
  const existentes = [];
  filas.forEach((f, i) => {
    const fecha = i > 0 && fecha_(f[0], zona), tipo = nombre_(f[1]);
    if (!fecha || !tipo) return;
    existentes.push(fecha + '|' + tipo);
    if (!(numero_(f[2]) > 0) && duraciones[tipo]) {
      hSes.getRange(i + 1, 3, 1, 2).setValues([[duraciones[tipo], 'Duración habitual: corregila si fue distinta']]);
    }
  });
  const nuevas = sesionesFaltantes_(existentes, rpe, duraciones);
  if (nuevas.length) {
    hSes.getRange(hSes.getLastRow() + 1, 1, nuevas.length, 4).setValues(nuevas.map((x) => {
      const [a, m, d] = x.fecha.split('-').map(Number);
      return [new Date(a, m - 1, d), x.tipo, x.duracion, 'Agregada sola por las respuestas del formulario: corregí la duración si fue distinta'];
    }));
  }
  return nuevas.length;
}

/**
 * Se ejecuta sola cada hora (ver activarLecturaAutomatica):
 * 1. agrega a Sesiones los días que tienen respuestas del formulario de RPE;
 * 2. lee los PDF nuevos de la carpeta "Planillas de partido (PDF)" y completa Estadísticas y Partidos.
 * Un PDF ya leído no se vuelve a leer.
 */
function procesarPlanillas() {
  const ss = SpreadsheetApp.openById(ID_CARGA), zona = ss.getSpreadsheetTimeZone();
  const sesionesNuevas = completarSesiones_(ss, zona);
  if (sesionesNuevas) Logger.log(`Se agregaron ${sesionesNuevas} sesiones a partir del formulario.`);
  const est = hojaConTitulos_(ss, 'Estadísticas', TITULOS_ESTADISTICAS);
  const eqv = hojaConTitulos_(ss, 'Equivalencias', ['Nombre en la planilla CAP', 'Jugador']);
  const hPlantel = ss.getSheetByName('Plantel'), hPartidos = ss.getSheetByName('Partidos');
  const colArchivo = TITULOS_ESTADISTICAS.indexOf('Archivo');
  const leidos = est.getDataRange().getValues().slice(1);
  const procesados = new Set(leidos.map((f) => String(f[colArchivo])));
  const usadas = new Set(leidos.map((f) => fecha_(f[0], zona)).filter(Boolean));
  const fechasPartido = leerSesiones_(ss.getSheetByName('Sesiones').getDataRange().getValues(), zona).filter((x) => x.tipo === 'Partido').map((x) => x.fecha);

  const archivos = DriveApp.getFolderById(CARPETA_PDF).getFilesByType(MimeType.PDF);
  let nuevos = 0;
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (procesados.has(archivo.getId())) continue;
    const p = parsearPlanilla_(textoDePdf_(archivo));
    const subido = Utilities.formatDate(archivo.getDateCreated(), zona, 'yyyy-MM-dd');
    if (!p.jugadores.length) {
      est.appendRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', archivo.getId(), `No se pudo leer "${archivo.getName()}": ¿es la planilla de la CAP con ${EQUIPO}?`]);
      continue;
    }
    const fechaSesion = fechaPartido_(subido, fechasPartido, usadas);
    const fecha = fechaSesion || subido;
    usadas.add(fecha);
    const notaFecha = fechaSesion ? '' : 'Revisá la fecha: no había un "Partido" en Sesiones esa semana; se usó el día en que se subió el PDF. ';

    // jugadores del plantel y equivalencias
    const plantel = hPlantel.getDataRange().getValues().slice(1).map((f) => nombre_(f[0])).filter(Boolean);
    const equivalencias = {};
    eqv.getDataRange().getValues().slice(1).forEach((f) => { if (nombre_(f[0]) && nombre_(f[1])) equivalencias[normalizar_(f[0])] = nombre_(f[1]); });

    const rival = p.rival.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    const filas = p.jugadores.map((j) => {
      let jugador = emparejar_(j.nombre, plantel, equivalencias), nota = notaFecha;
      if (!jugador) {
        jugador = nombreNuevo_(j.nombre);
        hPlantel.appendRow([jugador, 'Sí', 'Agregado desde una planilla de partido: revisá el nombre y las tildes']);
        plantel.push(jugador);
        nota += 'Jugador nuevo: se agregó al Plantel. ';
      }
      if (!equivalencias[normalizar_(j.nombre)]) { eqv.appendRow([j.nombre, jugador]); equivalencias[normalizar_(j.nombre)] = jugador; }
      j.jugador = jugador;
      return [fecha, rival, p.local ? 'Local' : 'Visitante', jugador, j.nombre, j.titular ? 'Sí' : '', j.minutos, j.puntos, j.t2c, j.t2i, j.t3c, j.t3i, j.tlc, j.tli,
        j.rebDef, j.rebOf, j.rebTot, j.asistencias, j.recuperos, j.perdidas, j.tapas, j.tapasRecibidas, j.faltas, j.faltasRecibidas, j.valoracion, j.masMenos, archivo.getId(), nota.trim()];
    });
    est.getRange(est.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);

    // minutos en Partidos: una columna por jugador, una fila por partido
    const titulos = hPartidos.getRange(1, 1, 1, Math.max(hPartidos.getLastColumn(), 2)).getValues()[0].map(nombre_);
    p.jugadores.forEach((j) => {
      if (titulos.indexOf(j.jugador) < 0) { titulos.push(j.jugador); hPartidos.getRange(1, titulos.length).setValue(j.jugador).setFontWeight('bold'); }
    });
    const datos = hPartidos.getDataRange().getValues();
    let fila = datos.findIndex((f, i) => i > 0 && fecha_(f[0], zona) === fecha && normalizar_(f[1]) === normalizar_(rival)) + 1;
    if (fila <= 0) {
      fila = hPartidos.getLastRow() + 1;
      const [a, m, d] = fecha.split('-').map(Number);
      hPartidos.getRange(fila, 1, 1, 2).setValues([[new Date(a, m - 1, d), rival]]);
    }
    p.jugadores.forEach((j) => hPartidos.getRange(fila, titulos.indexOf(j.jugador) + 1).setValue(j.minutos));
    nuevos++;
  }
  Logger.log(nuevos ? `Se leyeron ${nuevos} planillas nuevas.` : 'No había planillas nuevas.');
  if (nuevos || sesionesNuevas) CacheService.getScriptCache().remove('evaluaciones');
}

/** Muestra en el registro lo que se lee del PDF más nuevo de la carpeta, sin escribir nada en la planilla. */
function probarPlanilla() {
  const archivos = DriveApp.getFolderById(CARPETA_PDF).getFilesByType(MimeType.PDF);
  let ultimo = null;
  while (archivos.hasNext()) { const a = archivos.next(); if (!ultimo || a.getDateCreated() > ultimo.getDateCreated()) ultimo = a; }
  if (!ultimo) return Logger.log('La carpeta no tiene PDF.');
  const p = parsearPlanilla_(textoDePdf_(ultimo));
  const plantel = SpreadsheetApp.openById(ID_CARGA).getSheetByName('Plantel').getDataRange().getValues().slice(1).map((f) => nombre_(f[0])).filter(Boolean);
  Logger.log(`${ultimo.getName()}: ${p.local ? 'local' : 'visitante'} contra ${p.rival}, ${p.jugadores.length} jugadores`);
  p.jugadores.forEach((j) => Logger.log(`${j.nombre} → ${emparejar_(j.nombre, plantel, {}) || 'NUEVO: ' + nombreNuevo_(j.nombre)} · ${j.minutos} min · ${j.puntos} pts`));
}

/** Hace que procesarPlanillas se ejecute sola cada hora. Se ejecuta una sola vez. */
function activarLecturaAutomatica() {
  if (ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'procesarPlanillas')) return Logger.log('Ya estaba activada.');
  ScriptApp.newTrigger('procesarPlanillas').timeBased().everyHours(1).create();
  Logger.log('Listo: cada hora se leen los PDF nuevos de la carpeta.');
}

// ---------- Formulario de RPE ----------

const OPCIONES_RPE = ['0 – Reposo', '1 – Muy, muy fácil', '2 – Fácil', '3 – Moderado', '4 – Algo duro', '5 – Duro', '6', '7 – Muy duro', '8', '9', '10 – Máximo'];

/** Crea el formulario que completan los jugadores y lo conecta con la planilla CARGA PRIMERA. Se ejecuta una sola vez. */
function crearFormularioRPE() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) {
    Logger.log('El formulario ya existe: ' + props.getProperty('FORM_URL'));
    return;
  }
  const form = FormApp.create('¿Cuánto te costó? · Primera Unión');
  form.setDescription('Completalo apenas termina el entrenamiento o el partido. Tarda 10 segundos.')
    .setCollectEmail(false).setLimitOneResponsePerUser(false).setProgressBar(false)
    .setConfirmationMessage('¡Gracias! Quedó registrado.');
  form.addListItem().setTitle('Jugador').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Sesión').setChoiceValues(['Entrenamiento', 'Gimnasio', 'Partido', 'Otro']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Esfuerzo (RPE)')
    .setHelpText('¿Qué tan dura fue la sesión en general? 0 es nada, 10 es lo máximo que podrías hacer.')
    .setChoiceValues(OPCIONES_RPE).setRequired(true);
  form.addDateItem().setTitle('Fecha de la sesión').setHelpText('Solo si no es de hoy.').setRequired(false);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ID_CARGA);
  props.setProperty('FORM_ID', form.getId());
  props.setProperty('FORM_URL', form.getPublishedUrl());
  actualizarFormulario();
  SpreadsheetApp.flush();
  const hoja = SpreadsheetApp.openById(ID_CARGA).getSheets().find((h) => /^respuestas de formulario/i.test(h.getName()));
  if (hoja) hoja.setName('Respuestas RPE');
  Logger.log('Listo. Link para los jugadores: ' + form.getPublishedUrl());
}

/** Pone en la lista del formulario los jugadores activos de la pestaña Plantel. Ejecutalo cuando cambie el plantel. */
function actualizarFormulario() {
  const id = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!id) throw new Error('Primero ejecutá crearFormularioRPE.');
  const plantel = SpreadsheetApp.openById(ID_CARGA).getSheetByName('Plantel').getDataRange().getValues().slice(1)
    .filter((f) => nombre_(f[0]) && normalizar_(f[1]) !== 'no').map((f) => nombre_(f[0]));
  const form = FormApp.openById(id);
  const item = form.getItems(FormApp.ItemType.LIST)[0].asListItem();
  item.setChoiceValues(plantel);
  Logger.log(`Formulario con ${plantel.length} jugadores.`);
}

/** Muestra en el registro cuántas filas lee de cada pestaña. */
function probarLectura() {
  const d = leerTodo_();
  Logger.log(`Saltos: ${d.saltos.length} intentos · IFT: ${d.ift.length} tests · Encoder: ${d.encoder.length} cargas`);
  Logger.log(`Jugadores: ${[...new Set([...d.saltos, ...d.ift, ...d.encoder].map((r) => r.jugador))].join(', ')}`);
  if (d.carga.error) Logger.log('Carga: ' + d.carga.error);
  else Logger.log(`Carga: ${d.carga.sesiones.length} sesiones · ${d.carga.partidos.length} minutos de partido · ${d.carga.rpe.length} respuestas de RPE`);
}

if (typeof module !== 'undefined') module.exports = { columna_, numero_, fecha_, leerSaltos_, leerIft_, leerEncoder_, leerSesiones_, leerPartidos_, leerRpe_, rpe_, parsearPlanilla_, emparejar_, nombreNuevo_, fechaPartido_, sesionesFaltantes_ };
