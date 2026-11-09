/**
 * Estadísticas de partido (de la planilla de la CABB). Funciones puras, como calculos.js y carga.js.
 *
 * Entrada: [{ fecha, rival, local, jugador, titular, minutos, puntos, t2c, t2i, t3c, t3i, tlc, tli,
 *             rebDef, rebOf, rebTot, asistencias, recuperos, perdidas, tapas, faltas, valoracion, masMenos,
 *             puntosEquipo, puntosRival }]  (una fila por jugador y partido)
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Partidos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUMABLES = ['minutos', 'puntos', 't2c', 't2i', 't3c', 't3i', 'tlc', 'tli', 'rebDef', 'rebOf', 'rebTot', 'asistencias', 'recuperos', 'perdidas', 'tapas', 'faltas', 'valoracion', 'masMenos'];
  const redondear = (v, d = 1) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
  const pct = (c, i) => (i ? redondear((100 * c) / i, 0) : null);
  const sumar = (filas) => Object.fromEntries(SUMABLES.map((k) => [k, filas.reduce((t, r) => t + (r[k] || 0), 0)]));

  /**
   * Las planillas de U21 no traen rebotes, asistencias ni intentos de tiro (todo tiro figura convertido):
   * un partido así tiene "estadísticas básicas" y sus porcentajes no se muestran.
   */
  const completo = (rs) => rs.some((r) => r.rebTot > 0 || r.asistencias > 0 || r.t2i > r.t2c || r.t3i > r.t3c);

  /** Un partido por planilla (o por fecha y rival si no hay archivo), el más nuevo primero, con los jugadores ordenados por minutos. */
  function partidos(est) {
    const grupos = new Map();
    for (const r of est || []) {
      const k = r.archivo || `${r.fecha}|${r.rival}|${r.categoria || ''}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    }
    return [...grupos.values()].map((rs) => {
      const t = sumar(rs);
      const equipo = rs.find((r) => r.puntosEquipo != null);
      const propios = equipo ? equipo.puntosEquipo : t.puntos;
      const rival = equipo ? equipo.puntosRival : null;
      return {
        id: rs[0].archivo || `${rs[0].fecha}|${rs[0].rival}|${rs[0].categoria || ''}`,
        categoria: rs[0].categoria || 'Primera',
        completo: completo(rs),
        fecha: rs[0].fecha,
        rival: rs[0].rival,
        local: rs[0].local,
        puntosEquipo: propios,
        puntosRival: rival,
        resultado: rival == null ? null : propios > rival ? 'Ganó' : propios < rival ? 'Perdió' : 'Empató',
        fechaDudosa: rs.some((r) => r.fechaDudosa),
        archivo: (rs.find((r) => r.archivo) || {}).archivo || '',
        totales: { ...t, p2: pct(t.t2c, t.t2i), p3: pct(t.t3c, t.t3i), ptl: pct(t.tlc, t.tli) },
        jugadores: [...rs].sort((a, b) => b.minutos - a.minutos || b.puntos - a.puntos),
      };
    }).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }

  /**
   * Promedios por partido jugado (con minutos). Rebotes, asistencias y porcentajes salen solo de los partidos
   * con estadísticas completas. categoria: 'Primera', 'U21'... o vacío para todas.
   */
  function promedios(est, categoria) {
    const completos = new Set(partidos(est).filter((p) => p.completo).map((p) => p.id));
    const idDe = (r) => r.archivo || `${r.fecha}|${r.rival}|${r.categoria || ''}`;
    const porJugador = new Map();
    for (const r of (est || []).filter((x) => !categoria || (x.categoria || 'Primera') === categoria)) {
      if (!porJugador.has(r.jugador)) porJugador.set(r.jugador, []);
      porJugador.get(r.jugador).push(r);
    }
    return [...porJugador].map(([jugador, rs]) => {
      const jugados = rs.filter((r) => r.minutos > 0);
      const t = sumar(jugados), n = jugados.length;
      const prom = (k) => (n ? redondear(t[k] / n) : null);
      const comp = jugados.filter((r) => completos.has(idDe(r))), tc = sumar(comp), nc = comp.length;
      const promC = (k) => (nc ? redondear(tc[k] / nc) : null);
      return {
        jugador,
        convocado: rs.length,
        jugados: n,
        titular: rs.filter((r) => r.titular).length,
        minutos: prom('minutos'), puntos: prom('puntos'), valoracion: prom('valoracion'),
        rebotes: promC('rebTot'), asistencias: promC('asistencias'), recuperos: promC('recuperos'), perdidas: promC('perdidas'),
        masMenos: n ? t.masMenos : null,
        // libres: los intentos sí vienen en todas las planillas; dobles y triples, solo en las completas
        p2: pct(tc.t2c, tc.t2i), p3: pct(tc.t3c, tc.t3i), ptl: pct(t.tlc, t.tli),
        triples: n ? redondear(t.t3c / n) : null,
        t2: `${tc.t2c}/${tc.t2i}`, t3: `${tc.t3c}/${tc.t3i}`, tl: `${t.tlc}/${t.tli}`,
      };
    }).sort((a, b) => (b.minutos || 0) - (a.minutos || 0) || a.jugador.localeCompare(b.jugador, 'es'));
  }

  return { partidos, promedios, completo };
});
