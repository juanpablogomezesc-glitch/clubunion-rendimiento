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

if (typeof module !== 'undefined') module.exports = { columna_, numero_, fecha_, leerSaltos_, leerIft_, leerEncoder_, leerSesiones_, leerPartidos_, leerRpe_, rpe_ };
