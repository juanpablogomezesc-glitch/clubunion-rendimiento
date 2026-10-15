/**
 * Cálculos de las evaluaciones. Funciones puras: reciben los datos tal como los manda el script de Google
 * y devuelven lo que dibuja la página. No tocan la página, así se pueden probar con Node
 * (node --test pruebas/).
 *
 * Datos de entrada:
 *   saltos:  [{ jugador, fecha: 'AAAA-MM-DD', test: 'SJ'|'CMJ'|'Abalakov'|'CMJ D'|'CMJ I', intento, altura }]
 *   ift:     [{ jugador, fecha, vift }]
 *   encoder: [{ jugador, fecha, ejercicio: 'Sentadilla media'|'Press plano', carga, vmp (null si está "A revisar") }]
 *
 * Una evaluación es un mes: dos fechas del mismo mes (por ejemplo press el 6/2 y sentadilla el 17/2) cuentan juntas.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Calculos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /** Los tests que se comparan. El orden es el de las tablas. */
  const INDICADORES = [
    { id: 'Resistencia (VIFT)', area: 'Resistencia intermitente', unidad: 'km/h', dec: 1 },
    { id: 'Salto CMJ', area: 'Salto', test: 'CMJ', unidad: 'cm', dec: 1 },
    { id: 'Salto SJ', area: 'Salto', test: 'SJ', unidad: 'cm', dec: 1 },
    { id: 'Salto Abalakov', area: 'Salto', test: 'Abalakov', unidad: 'cm', dec: 1 },
    { id: 'Sentadilla 80 kg', area: 'Fuerza tren inferior', ejercicio: 'Sentadilla media', carga: 80, unidad: 'm/s', dec: 2 },
    { id: 'Sentadilla 100 kg', area: 'Fuerza tren inferior', ejercicio: 'Sentadilla media', carga: 100, unidad: 'm/s', dec: 2 },
    { id: 'Press plano 60 kg', area: 'Fuerza tren superior', ejercicio: 'Press plano', carga: 60, unidad: 'm/s', dec: 2 },
    { id: 'Press plano 80 kg', area: 'Fuerza tren superior', ejercicio: 'Press plano', carga: 80, unidad: 'm/s', dec: 2 },
  ];
  const INDICADOR = Object.fromEntries(INDICADORES.map((i) => [i.id, i]));

  const UMBRAL_BAJA = -5;        // % de cambio desde el que un jugador aparece en "Para observar"
  const UMBRAL_ASIMETRIA = 15;   // % de asimetría entre piernas (orientativo)
  const LARGO_CANCHA = 28;       // m
  const INTERVALOS = [30, 20, 15, 10]; // segundos de trabajo (con la misma pausa)
  const INTENSIDADES = [80, 85, 90, 95, 100]; // % de la VIFT

  const periodoDe = (fecha) => String(fecha).slice(0, 7);
  const agrupar = (lista, clave) => {
    const m = new Map();
    for (const x of lista) {
      const k = clave(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const redondear = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  const cambioPct = (antes, despues) => redondear(((despues - antes) / antes) * 100, 1);

  /** "2026-02" → "Febrero" (o "Febrero 2026" si hay datos de más de un año). */
  function nombresDePeriodos(periodos) {
    const anios = new Set(periodos.map((p) => p.slice(0, 4)));
    return Object.fromEntries(periodos.map((p) => [p, MESES[+p.slice(5, 7) - 1] + (anios.size > 1 ? ' ' + p.slice(0, 4) : '')]));
  }

  /** El mejor intento de cada jugador en cada salto y cada mes. */
  function mejoresSaltos(saltos) {
    const out = [];
    for (const [, rs] of agrupar(saltos.filter((r) => r.altura > 0), (r) => `${r.jugador}|${periodoDe(r.fecha)}|${r.test}`)) {
      out.push({ jugador: rs[0].jugador, periodo: periodoDe(rs[0].fecha), test: rs[0].test, altura: Math.max(...rs.map((r) => r.altura)) });
    }
    return out;
  }

  /** |derecha − izquierda| / pierna más fuerte, con el mejor CMJ a una pierna de cada mes. */
  function asimetrias(mejores) {
    const out = [];
    for (const [, rs] of agrupar(mejores, (r) => `${r.jugador}|${r.periodo}`)) {
      const d = rs.find((r) => r.test === 'CMJ D'), i = rs.find((r) => r.test === 'CMJ I');
      if (!d || !i) continue;
      out.push({ jugador: d.jugador, periodo: d.periodo, derecha: d.altura, izquierda: i.altura, asimetria: redondear((Math.abs(d.altura - i.altura) / Math.max(d.altura, i.altura)) * 100, 1) });
    }
    return out;
  }

  /** Un valor por jugador, test y mes. */
  function valores(ift, mejores, encoder) {
    const out = [];
    for (const [, rs] of agrupar(ift.filter((r) => r.vift > 0), (r) => `${r.jugador}|${periodoDe(r.fecha)}`)) {
      out.push({ indicador: 'Resistencia (VIFT)', jugador: rs[0].jugador, periodo: periodoDe(rs[0].fecha), valor: Math.max(...rs.map((r) => r.vift)) });
    }
    for (const ind of INDICADORES.filter((i) => i.test)) {
      for (const r of mejores.filter((x) => x.test === ind.test)) out.push({ indicador: ind.id, jugador: r.jugador, periodo: r.periodo, valor: r.altura });
    }
    for (const ind of INDICADORES.filter((i) => i.ejercicio)) {
      const rs = encoder.filter((r) => r.ejercicio === ind.ejercicio && r.carga === ind.carga && r.vmp != null && r.vmp > 0);
      for (const [, g] of agrupar(rs, (r) => `${r.jugador}|${periodoDe(r.fecha)}`)) {
        out.push({ indicador: ind.id, jugador: g[0].jugador, periodo: periodoDe(g[0].fecha), valor: Math.max(...g.map((r) => r.vmp)) });
      }
    }
    return out;
  }

  /**
   * Cambio entre la primera y la última evaluación de cada test (las del plantel, no las de cada jugador),
   * para los jugadores que tienen las dos. Así todos se comparan en las mismas fechas.
   */
  function cambios(vals) {
    const out = [];
    for (const [indicador, rs] of agrupar(vals, (r) => r.indicador)) {
      const ps = [...new Set(rs.map((r) => r.periodo))].sort();
      if (ps.length < 2) continue;
      const desde = ps[0], hasta = ps[ps.length - 1];
      for (const [jugador, js] of agrupar(rs, (r) => r.jugador)) {
        const a = js.find((r) => r.periodo === desde), b = js.find((r) => r.periodo === hasta);
        if (a && b) out.push({ indicador, jugador, desde, hasta, antes: a.valor, despues: b.valor, cambio: cambioPct(a.valor, b.valor) });
      }
    }
    return out;
  }

  /** Promedio del plantel al principio y al final, con los mismos jugadores. */
  function equipo(cbs) {
    return [...agrupar(cbs, (r) => r.indicador)].map(([indicador, rs]) => {
      const a = media(rs.map((r) => r.antes)), b = media(rs.map((r) => r.despues));
      return { indicador, desde: rs[0].desde, hasta: rs[0].hasta, jugadores: rs.length, antes: a, despues: b, cambio: cambioPct(a, b), mejoraron: rs.filter((r) => r.despues > r.antes).length };
    }).sort((x, y) => INDICADORES.findIndex((i) => i.id === x.indicador) - INDICADORES.findIndex((i) => i.id === y.indicador));
  }

  /** Lo que conviene observar: bajas de 5 % o más y asimetrías de 15 % o más (la última de cada jugador). */
  function alertas(cbs, asims) {
    const bajas = cbs.filter((r) => r.cambio <= UMBRAL_BAJA).map((r) => ({ jugador: r.jugador, tipo: 'Bajó', indicador: r.indicador, valor: r.cambio, periodo: r.hasta }));
    const ultimas = [...agrupar(asims, (r) => r.jugador)].map(([, rs]) => rs.sort((a, b) => (a.periodo < b.periodo ? 1 : -1))[0]);
    const asim = ultimas.filter((r) => r.asimetria >= UMBRAL_ASIMETRIA).map((r) => ({ jugador: r.jugador, tipo: 'Asimetría entre piernas', indicador: 'CMJ a una pierna', valor: r.asimetria, periodo: r.periodo }));
    return [...bajas, ...asim].sort((a, b) => a.jugador.localeCompare(b.jugador, 'es') || a.valor - b.valor);
  }

  /** Puesto de cada jugador entre los evaluados ese mes (1 es el mejor). */
  function posiciones(vals) {
    const out = [];
    for (const [, rs] of agrupar(vals, (r) => `${r.indicador}|${r.periodo}`)) {
      [...rs].sort((a, b) => b.valor - a.valor).forEach((r, i, todos) => out.push({ indicador: r.indicador, periodo: r.periodo, jugador: r.jugador, puesto: i + 1, de: todos.length }));
    }
    return out;
  }

  /** Metros por pasada a un % de la VIFT, y cuántos largos de cancha son. */
  function distancia(vift, pct, segundos, largo = LARGO_CANCHA) {
    const velocidad = (vift * pct) / 100;
    const metros = Math.round((velocidad / 3.6) * segundos);
    return { velocidad: redondear(velocidad, 1), metros, canchas: Math.floor(metros / largo), resto: metros % largo };
  }

  /** La última VIFT de cada jugador. */
  function ultimaVift(vals) {
    const out = new Map();
    for (const r of vals.filter((x) => x.indicador === 'Resistencia (VIFT)')) {
      const prev = out.get(r.jugador);
      if (!prev || r.periodo > prev.periodo) out.set(r.jugador, r);
    }
    return out;
  }

  /** Todo lo que necesita la página, a partir de lo que manda el script. */
  function preparar(datos) {
    const saltos = datos.saltos || [], ift = datos.ift || [], encoder = datos.encoder || [];
    const mejores = mejoresSaltos(saltos);
    const asims = asimetrias(mejores);
    const vals = valores(ift, mejores, encoder);
    const cbs = cambios(vals);
    const periodos = [...new Set([...saltos, ...ift, ...encoder].map((r) => periodoDe(r.fecha)))].sort();
    const jugadores = [...new Set([...saltos, ...ift, ...encoder].map((r) => r.jugador))].sort((a, b) => a.localeCompare(b, 'es'));
    return {
      periodos,
      nombrePeriodo: nombresDePeriodos(periodos),
      jugadores,
      mejores,
      asimetrias: asims,
      valores: vals,
      cambios: cbs,
      equipo: equipo(cbs),
      alertas: alertas(cbs, asims),
      posiciones: posiciones(vals),
      vift: ultimaVift(vals),
      encoder: encoder.filter((r) => r.vmp != null && r.vmp > 0).map((r) => ({ ...r, periodo: periodoDe(r.fecha) })),
    };
  }

  return { MESES, INDICADORES, INDICADOR, INTERVALOS, INTENSIDADES, LARGO_CANCHA, UMBRAL_BAJA, UMBRAL_ASIMETRIA, periodoDe, nombresDePeriodos, mejoresSaltos, asimetrias, valores, cambios, equipo, alertas, posiciones, distancia, ultimaVift, preparar };
});
