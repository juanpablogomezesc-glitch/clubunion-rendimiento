/**
 * Cálculos de carga (minutos y RPE). Funciones puras, como calculos.js: se prueban con Node.
 *
 * Entrada (lo que manda el script desde la planilla CARGA PRIMERA):
 *   sesiones: [{ fecha: 'AAAA-MM-DD', tipo: 'Entrenamiento'|'Gimnasio'|'Partido'|'Otro', duracion }]
 *   partidos: [{ fecha, rival, jugador, minutos }]
 *   rpe:      [{ fecha, jugador, tipo, rpe }]   (formulario que completan los jugadores)
 *   plantel:  ['Nombre', ...] activos
 *
 * Carga de una sesión = RPE × minutos (método de Foster, UA). En un partido los minutos son los que jugó;
 * en el resto, la duración de la sesión.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Carga = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RELACION = [
    { hasta: 0.8, nombre: 'Baja', tono: 'neutro' },
    { hasta: 1.3, nombre: 'Normal', tono: 'ok' },
    { hasta: 1.5, nombre: 'Alta', tono: 'aviso' },
    { hasta: Infinity, nombre: 'Muy alta', tono: 'mal' },
  ];

  const dia = (s) => new Date(s + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const sumarDias = (s, n) => { const d = dia(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const lunes = (s) => sumarDias(s, -((dia(s).getUTCDay() + 6) % 7));
  const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const redondear = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
  const entre = (f, desde, hasta) => f >= desde && f <= hasta;

  /** Cada respuesta de RPE con sus minutos y su carga. Si un jugador respondió dos veces la misma sesión, vale la última. */
  function registros(c) {
    const unicas = new Map();
    for (const r of c.rpe || []) unicas.set(`${r.jugador}|${r.fecha}|${r.tipo}`, r);
    return [...unicas.values()].map((r) => {
      let minutos = null;
      if (r.tipo === 'Partido') {
        const p = (c.partidos || []).find((x) => x.jugador === r.jugador && x.fecha === r.fecha);
        if (p) minutos = p.minutos;
      }
      if (minutos == null) {
        const s = (c.sesiones || []).find((x) => x.fecha === r.fecha && x.tipo === r.tipo) || (c.sesiones || []).find((x) => x.fecha === r.fecha);
        if (s) minutos = s.duracion;
      }
      return { jugador: r.jugador, fecha: r.fecha, semana: lunes(r.fecha), tipo: r.tipo, rpe: r.rpe, minutos, carga: minutos == null ? null : r.rpe * minutos };
    }).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }

  function estadoRelacion(v) {
    if (v == null) return null;
    return RELACION.find((r) => v < r.hasta);
  }

  /**
   * Todo lo que muestra la pestaña Carga.
   * hoy: 'AAAA-MM-DD' (el último día que se considera).
   */
  function preparar(c, hoy, semanasGrafico = 8) {
    if (!c) return { vacio: true, error: null };
    if (c.error) return { vacio: true, error: c.error };
    const regs = registros(c);
    const sesiones = c.sesiones || [], partidos = c.partidos || [];
    const vacio = !regs.length && !sesiones.length && !partidos.length;

    // Semanas del gráfico: las últimas N hasta la de hoy
    const semanaHoy = lunes(hoy);
    const semanas = Array.from({ length: semanasGrafico }, (_, i) => sumarDias(semanaHoy, -7 * (semanasGrafico - 1 - i)));
    const equipoSemanal = semanas.map((s) => {
      const rs = regs.filter((r) => r.semana === s && r.carga != null);
      const porJugador = [...new Set(rs.map((r) => r.jugador))].map((j) => rs.filter((r) => r.jugador === j).reduce((t, r) => t + r.carga, 0));
      return { semana: s, carga: redondear(media(porJugador)), jugadores: porJugador.length, sesiones: sesiones.filter((x) => lunes(x.fecha) === s).length };
    });

    // Ventanas móviles: últimos 7 días (aguda) y las 4 semanas anteriores (crónica, promedio semanal)
    const desde7 = sumarDias(hoy, -6), desde7prev = sumarDias(hoy, -13), hasta7prev = sumarDias(hoy, -7);
    const desde28 = sumarDias(hoy, -34), hasta28 = sumarDias(hoy, -7);
    const sumaCarga = (rs) => rs.reduce((t, r) => t + (r.carga || 0), 0);

    const nombres = [...new Set([...(c.plantel || []), ...regs.map((r) => r.jugador), ...partidos.map((p) => p.jugador)])].sort((a, b) => a.localeCompare(b, 'es'));
    const jugadores = nombres.map((j) => {
      const mios = regs.filter((r) => r.jugador === j);
      const ult7 = mios.filter((r) => entre(r.fecha, desde7, hoy));
      const prev = mios.filter((r) => entre(r.fecha, desde28, hasta28));
      // la crónica solo vale si el jugador tiene datos que cubren al menos 3 de esas 4 semanas
      const semanasConDatos = new Set(prev.map((r) => r.semana)).size;
      const aguda = ult7.length ? sumaCarga(ult7) : null;
      const cronica = semanasConDatos >= 3 ? sumaCarga(prev) / 4 : null;
      const relacion = aguda != null && cronica ? redondear(aguda / cronica, 2) : null;
      const pts = partidos.filter((p) => p.jugador === j).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      const jugados = pts.filter((p) => p.minutos > 0);
      return {
        jugador: j,
        aguda: redondear(aguda),
        cronica: redondear(cronica),
        relacion,
        estado: estadoRelacion(relacion),
        rpe7: redondear(media(ult7.map((r) => r.rpe)), 1),
        respuestas7: ult7.length,
        minutosTotal: pts.reduce((t, p) => t + p.minutos, 0),
        partidosJugados: jugados.length,
        minutosPromedio: redondear(media(jugados.map((p) => p.minutos)), 1),
        ultimoPartido: pts.length ? pts[pts.length - 1] : null,
        semanal: semanas.map((s) => ({ semana: s, carga: redondear(mios.filter((r) => r.semana === s).reduce((t, r) => t + (r.carga || 0), 0)) || null })),
      };
    });

    // Equipo: promedio por jugador de los últimos 7 días contra los 7 anteriores
    const promedioVentana = (d, h) => {
      const rs = regs.filter((r) => entre(r.fecha, d, h) && r.carga != null);
      const js = [...new Set(rs.map((r) => r.jugador))];
      return js.length ? js.map((j) => sumaCarga(rs.filter((r) => r.jugador === j))).reduce((a, b) => a + b, 0) / js.length : null;
    };
    const carga7 = promedioVentana(desde7, hoy), cargaPrev = promedioVentana(desde7prev, hasta7prev);

    // Cumplimiento del formulario en las sesiones de los últimos 14 días
    const activos = (c.plantel || []).length || nombres.length;
    const ses14 = sesiones.filter((s) => entre(s.fecha, sumarDias(hoy, -13), hoy));
    const respondidas = ses14.reduce((t, s) => t + regs.filter((r) => r.fecha === s.fecha && r.tipo === s.tipo).length, 0);
    const cumplimiento = ses14.length && activos ? Math.min(100, Math.round((100 * respondidas) / (ses14.length * activos))) : null;

    const fechasPartido = [...new Set(partidos.map((p) => p.fecha))].sort();
    const fUlt = fechasPartido[fechasPartido.length - 1];
    const ultimoPartido = fUlt ? { fecha: fUlt, rival: (partidos.find((p) => p.fecha === fUlt) || {}).rival || '', jugaron: partidos.filter((p) => p.fecha === fUlt && p.minutos > 0).length } : null;

    // Sesiones de las últimas 2 semanas, con cuántos respondieron (la duración se puede corregir desde la página)
    const sesionesRecientes = sesiones.filter((s) => entre(s.fecha, sumarDias(hoy, -13), hoy))
      .map((s) => ({ ...s, respuestas: regs.filter((r) => r.fecha === s.fecha && r.tipo === s.tipo).length }))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    return {
      vacio,
      error: null,
      sesionesRecientes,
      novedades: c.novedades || [],
      hoy,
      formulario: c.formulario || '',
      registros: regs,
      equipoSemanal,
      jugadores,
      carga7: redondear(carga7),
      cambio7: carga7 != null && cargaPrev ? redondear(((carga7 - cargaPrev) / cargaPrev) * 100, 1) : null,
      sesiones7: sesiones.filter((s) => entre(s.fecha, desde7, hoy)).length,
      cumplimiento,
      ultimoPartido,
      sinMinutos: regs.filter((r) => r.carga == null).length,
    };
  }

  /** El día más reciente con datos (para la vista de ejemplo). */
  function ultimaFecha(c) {
    const fs = [...(c.sesiones || []), ...(c.partidos || []), ...(c.rpe || [])].map((r) => r.fecha).sort();
    return fs[fs.length - 1] || null;
  }

  return { RELACION, lunes, sumarDias, registros, estadoRelacion, preparar, ultimaFecha };
});
