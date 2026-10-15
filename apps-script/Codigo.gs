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
  };
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

/** Muestra en el registro cuántas filas lee de cada pestaña. */
function probarLectura() {
  const d = leerTodo_();
  Logger.log(`Saltos: ${d.saltos.length} intentos · IFT: ${d.ift.length} tests · Encoder: ${d.encoder.length} cargas`);
  Logger.log(`Jugadores: ${[...new Set([...d.saltos, ...d.ift, ...d.encoder].map((r) => r.jugador))].join(', ')}`);
}

if (typeof module !== 'undefined') module.exports = { columna_, numero_, fecha_, leerSaltos_, leerIft_, leerEncoder_ };
