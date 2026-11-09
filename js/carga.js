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

  /** RPE que se usa para un partido cuando el jugador no respondió el formulario (si nadie respondió nunca un partido). */
  const RPE_PARTIDO = 7;

  /**
   * Cada respuesta de RPE con sus minutos y su carga. Si un jugador respondió dos veces la misma sesión, vale la última.
   * Los partidos cuentan siempre: si el jugador jugó y no respondió, la carga se estima con sus minutos y el RPE
   * medio de los partidos que sí se respondieron (o RPE_PARTIDO si todavía no hay ninguno). Esas filas llevan estimada: true.
   */
  function registros(c) {
    const unicas = new Map();
    for (const r of c.rpe || []) unicas.set(`${r.jugador}|${r.fecha}|${r.tipo}`, r);
    const reales = [...unicas.values()].map((r) => {
      let minutos = null;
      if (r.tipo === 'Partido') {
        const p = (c.partidos || []).find((x) => x.jugador === r.jugador && x.fecha === r.fecha);
        if (p) minutos = p.minutos;
      }
      if (minutos == null) {
        const s = (c.sesiones || []).find((x) => x.fecha === r.fecha && x.tipo === r.tipo) || (c.sesiones || []).find((x) => x.fecha === r.fecha);
        if (s) minutos = s.duracion;
      }
      return { jugador: r.jugador, fecha: r.fecha, semana: lunes(r.fecha), tipo: r.tipo, rpe: r.rpe, minutos, carga: minutos == null ? null : r.rpe * minutos, estimada: false };
    });
    const rpePartidos = reales.filter((r) => r.tipo === 'Partido').map((r) => r.rpe);
    const rpeEstimado = rpePartidos.length ? redondear(media(rpePartidos), 1) : RPE_PARTIDO;
    const respondidos = new Set(reales.filter((r) => r.tipo === 'Partido').map((r) => `${r.jugador}|${r.fecha}`));
    const estimadas = (c.partidos || []).filter((p) => p.minutos > 0 && !respondidos.has(`${p.jugador}|${p.fecha}`))
      .map((p) => ({ jugador: p.jugador, fecha: p.fecha, semana: lunes(p.fecha), tipo: 'Partido', rpe: rpeEstimado, minutos: p.minutos, carga: rpeEstimado * p.minutos, estimada: true }));
    return [...reales, ...estimadas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
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
    const respuestas = regs.filter((r) => !r.estimada);
    const sesiones = c.sesiones || [], partidos = c.partidos || [];
    const vacio = !regs.length && !sesiones.length && !partidos.length;

    // Semanas del gráfico: las últimas N hasta la de hoy
    const semanaHoy = lunes(hoy);
    let semanas = Array.from({ length: semanasGrafico }, (_, i) => sumarDias(semanaHoy, -7 * (semanasGrafico - 1 - i)));
    // si los datos empiezan hace menos de N semanas, el gráfico arranca en la primera semana con datos (mínimo 4 barras)
    const primera = regs.length ? lunes(regs[0].fecha) : semanaHoy;
    const desde = semanas.findIndex((s) => s >= primera);
    if (desde > 0) semanas = semanas.slice(Math.min(desde, semanas.length - 4));
    // promedio por jugador, separado por tipo de sesión (las partes suman la carga total)
    const promedioPorTipo = (rs) => {
      rs = rs.filter((r) => r.carga != null);
      const js = new Set(rs.map((r) => r.jugador)).size;
      const partes = {};
      for (const r of rs) partes[r.tipo] = (partes[r.tipo] || 0) + r.carga;
      for (const k of Object.keys(partes)) partes[k] = redondear(partes[k] / js);
      return { carga: js ? redondear(rs.reduce((t, r) => t + r.carga, 0) / js) : null, jugadores: js, partes, estimada: rs.some((r) => r.estimada) };
    };
    const equipoSemanal = semanas.map((s) => ({ semana: s, ...promedioPorTipo(regs.filter((r) => r.semana === s)), sesiones: sesiones.filter((x) => lunes(x.fecha) === s).length }));
    const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
    const equipoDiario = dias.map((d) => ({ semana: d, dia: true, ...promedioPorTipo(regs.filter((r) => r.fecha === d)) }));

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
        rpe7: redondear(media(ult7.filter((r) => !r.estimada).map((r) => r.rpe)), 1),
        respuestas7: ult7.filter((r) => !r.estimada).length,
        estimada7: ult7.some((r) => r.estimada),
        minutosTotal: pts.reduce((t, p) => t + p.minutos, 0),
        partidosJugados: jugados.length,
        minutosPromedio: redondear(media(jugados.map((p) => p.minutos)), 1),
        ultimoPartido: pts.length ? pts[pts.length - 1] : null,
        semanal: semanas.map((s) => ({ semana: s, ...promedioPorTipo(mios.filter((r) => r.semana === s)) })),
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
    const respondidas = ses14.reduce((t, s) => t + respuestas.filter((r) => r.fecha === s.fecha && r.tipo === s.tipo).length, 0);
    const cumplimiento = ses14.length && activos ? Math.min(100, Math.round((100 * respondidas) / (ses14.length * activos))) : null;

    const fechasPartido = [...new Set(partidos.map((p) => p.fecha))].sort();
    const fUlt = fechasPartido[fechasPartido.length - 1];
    const ultimoPartido = fUlt ? { fecha: fUlt, rival: (partidos.find((p) => p.fecha === fUlt) || {}).rival || '', jugaron: partidos.filter((p) => p.fecha === fUlt && p.minutos > 0).length } : null;

    // Sesiones de las últimas 2 semanas, con cuántos respondieron (la duración se puede corregir desde la página)
    const sesionesRecientes = sesiones.filter((s) => entre(s.fecha, sumarDias(hoy, -13), hoy))
      .map((s) => ({ ...s, respuestas: respuestas.filter((r) => r.fecha === s.fecha && r.tipo === s.tipo).length }))
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
      equipoDiario,
      jugadores,
      carga7: redondear(carga7),
      cambio7: carga7 != null && cargaPrev ? redondear(((carga7 - cargaPrev) / cargaPrev) * 100, 1) : null,
      sesiones7: sesiones.filter((s) => entre(s.fecha, desde7, hoy)).length,
      cumplimiento,
      ultimoPartido,
      sinMinutos: regs.filter((r) => r.carga == null).length,
      estimadas: regs.filter((r) => r.estimada).length,
      rpeEstimado: (regs.find((r) => r.estimada) || {}).rpe || null,
      minutosPartido: minutosPartido(partidos, jugadores.map((j) => j.jugador)),
    };
  }

  /** Tabla jugador × partido con los minutos jugados (los últimos 8 partidos), para ver la carga de partidos sin el formulario. */
  function minutosPartido(partidos, nombres, cuantos = 8) {
    const claves = [...new Map(partidos.map((p) => [`${p.fecha}|${p.rival}`, { fecha: p.fecha, rival: p.rival, categoria: p.categoria || (/\(U\d{2}\)/.test(p.rival) ? 'U21' : 'Primera') }])).entries()]
      .sort((a, b) => (a[1].fecha < b[1].fecha ? -1 : a[1].fecha > b[1].fecha ? 1 : 0)).slice(-cuantos);
    const filas = nombres.map((j) => {
      const mins = claves.map(([k]) => { const p = partidos.find((x) => x.jugador === j && `${x.fecha}|${x.rival}` === k); return p ? p.minutos : null; });
      return { jugador: j, minutos: mins, total: redondear(mins.reduce((t, m) => t + (m || 0), 0)) };
    }).filter((f) => f.minutos.some((m) => m != null)).sort((a, b) => b.total - a.total);
    return { partidos: claves.map(([, v]) => v), filas };
  }

  /** El día más reciente con datos (para la vista de ejemplo). */
  function ultimaFecha(c) {
    const fs = [...(c.sesiones || []), ...(c.partidos || []), ...(c.rpe || [])].map((r) => r.fecha).sort();
    return fs[fs.length - 1] || null;
  }

  return { RELACION, RPE_PARTIDO, minutosPartido, lunes, sumarDias, registros, estadoRelacion, preparar, ultimaFecha };
});
