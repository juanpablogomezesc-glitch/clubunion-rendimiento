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

  /** Un partido por fecha y rival, el más nuevo primero, con los jugadores ordenados por minutos. */
  function partidos(est) {
    const grupos = new Map();
    for (const r of est || []) {
      const k = `${r.fecha}|${r.rival}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    }
    return [...grupos.values()].map((rs) => {
      const t = sumar(rs);
      const equipo = rs.find((r) => r.puntosEquipo != null);
      const propios = equipo ? equipo.puntosEquipo : t.puntos;
      const rival = equipo ? equipo.puntosRival : null;
      return {
        id: `${rs[0].fecha}|${rs[0].rival}`,
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

  /** Promedios por partido jugado (con minutos) y porcentajes de tiro de toda la temporada. */
  function promedios(est) {
    const porJugador = new Map();
    for (const r of est || []) {
      if (!porJugador.has(r.jugador)) porJugador.set(r.jugador, []);
      porJugador.get(r.jugador).push(r);
    }
    return [...porJugador].map(([jugador, rs]) => {
      const jugados = rs.filter((r) => r.minutos > 0);
      const t = sumar(jugados), n = jugados.length;
      const prom = (k) => (n ? redondear(t[k] / n) : null);
      return {
        jugador,
        convocado: rs.length,
        jugados: n,
        titular: rs.filter((r) => r.titular).length,
        minutos: prom('minutos'), puntos: prom('puntos'), rebotes: prom('rebTot'), asistencias: prom('asistencias'),
        recuperos: prom('recuperos'), perdidas: prom('perdidas'), valoracion: prom('valoracion'),
        masMenos: n ? t.masMenos : null,
        p2: pct(t.t2c, t.t2i), p3: pct(t.t3c, t.t3i), ptl: pct(t.tlc, t.tli),
        t2: `${t.t2c}/${t.t2i}`, t3: `${t.t3c}/${t.t3i}`, tl: `${t.tlc}/${t.tli}`,
      };
    }).sort((a, b) => (b.minutos || 0) - (a.minutos || 0) || a.jugador.localeCompare(b.jugador, 'es'));
  }

  return { partidos, promedios };
});
