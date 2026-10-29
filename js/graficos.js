/**
 * Gráficos (d3). Cada función recibe la caja donde dibujar y las filas ya calculadas;
 * no sabe nada de la planilla ni de las pestañas.
 */
(function () {
  'use strict';

  const nf = (v, d) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const tip = document.getElementById('tooltip');

  function mostrar(evt, cabeza, linea) {
    tip.replaceChildren();
    const h = document.createElement('div'); h.className = 'h'; h.textContent = cabeza;
    const l = document.createElement('div'); l.textContent = linea;
    tip.append(h, l);
    tip.hidden = false;
    const w = tip.offsetWidth, hgt = tip.offsetHeight;
    let x = evt.clientX + 14, y = evt.clientY + 14;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + hgt > window.innerHeight - 8) y = evt.clientY - hgt - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  const ocultar = () => { tip.hidden = true; };
  window.addEventListener('scroll', ocultar, { passive: true });

  // en pantallas táctiles, tocar un punto muestra el dato; tocar afuera lo oculta
  const conTip = (sel, cabeza, linea) => sel
    .on('mousemove', (e, d) => mostrar(e, cabeza(d), linea(d)))
    .on('click', (e, d) => { e.stopPropagation(); mostrar(e, cabeza(d), linea(d)); })
    .on('mouseleave', ocultar)
    .style('cursor', 'pointer');
  document.addEventListener('click', ocultar);

  function lienzo(box, h) {
    box.replaceChildren();
    const w = box.clientWidth;
    if (!w) return null;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);
    return { svg, w };
  }

  const anchoTexto = (svg, textos, size) => {
    const g = svg.append('g').attr('font-size', size);
    const w = d3.max(textos, (t) => g.append('text').text(t).node().getComputedTextLength()) || 0;
    g.remove();
    return w;
  };

  function ejeX(svg, x, alto, ticks, fmt) {
    for (const t of ticks) {
      svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', alto).attr('stroke', 'var(--grid)');
      svg.append('text').attr('x', x(t)).attr('y', alto + 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(fmt(t));
    }
  }

  function vacio(box, texto) {
    box.replaceChildren();
    const p = document.createElement('p'); p.className = 'nota'; p.textContent = texto;
    box.append(p);
  }

  /** Un renglón por jugador y un punto por fecha. filas: [{ jugador, periodo, valor }] */
  function porJugador(box, filas, o) {
    if (!filas.length) return vacio(box, 'Todavía no hay datos de este test.');
    const jugadores = [...d3.group(filas, (r) => r.jugador)].map(([j, rs]) => {
      const ord = [...rs].sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
      return { j, rs: ord, ultimo: ord[ord.length - 1] };
    }).sort((a, b) => b.ultimo.valor - a.ultimo.valor);
    const fila = 30, arriba = 8, alto = arriba + jugadores.length * fila;
    const c = lienzo(box, alto + 26);
    if (!c) return;
    const { svg, w } = c;
    const izq = anchoTexto(svg, jugadores.map((p) => p.j), 13) + 14;
    const der = anchoTexto(svg, jugadores.map((p) => nf(p.ultimo.valor, o.dec)), 13) + 16;
    const ext = d3.extent(filas, (r) => r.valor), pad = (ext[1] - ext[0]) * 0.06 || 1;
    const x = d3.scaleLinear([ext[0] - pad, ext[1] + pad], [izq, w - der]);
    ejeX(svg, x, alto, x.ticks(Math.max(2, Math.floor((w - izq - der) / 80))), (t) => nf(t, o.dec === 2 ? 1 : 0));
    jugadores.forEach((p, i) => {
      const cy = arriba + i * fila + fila / 2;
      svg.append('text').attr('x', 0).attr('y', cy + 4).attr('font-size', 13).attr('fill', 'var(--texto)').text(p.j);
      const vs = p.rs.map((r) => r.valor);
      if (vs.length > 1) svg.append('line').attr('x1', x(d3.min(vs))).attr('x2', x(d3.max(vs))).attr('y1', cy).attr('y2', cy).attr('stroke', 'var(--eje)').attr('stroke-width', 2).attr('stroke-linecap', 'round');
      conTip(svg.selectAll(null).data(p.rs).join('circle').attr('cx', (r) => x(r.valor)).attr('cy', cy).attr('r', 6.5)
        .attr('fill', (r) => o.color(r.periodo)).attr('stroke', 'var(--panel)').attr('stroke-width', 2),
        (r) => `${p.j} · ${o.nombre(r.periodo)}`, (r) => `${nf(r.valor, o.dec)} ${o.unidad}`);
      svg.append('text').attr('x', w - der + 12).attr('y', cy + 4).attr('font-size', 13).attr('fill', 'var(--texto-2)').text(nf(p.ultimo.valor, o.dec));
    });
  }

  /** Barras de asimetría con la franja orientativa de 10 a 15 %. filas: [{ jugador, asimetria, derecha, izquierda }] */
  function asimetria(box, filas, o) {
    if (!filas.length) return vacio(box, 'No hay saltos a una pierna cargados.');
    const ord = [...filas].sort((a, b) => b.asimetria - a.asimetria);
    const fila = 28, arriba = 8, alto = arriba + ord.length * fila;
    const c = lienzo(box, alto + 26);
    if (!c) return;
    const { svg, w } = c;
    const izq = anchoTexto(svg, ord.map((r) => r.jugador), 13) + 14, der = 56;
    const x = d3.scaleLinear([0, Math.max(25, d3.max(ord, (r) => r.asimetria) + 2)], [izq, w - der]);
    svg.append('rect').attr('x', x(10)).attr('width', x(15) - x(10)).attr('y', 0).attr('height', alto).attr('fill', 'var(--rojo-suave)');
    ejeX(svg, x, alto, x.ticks(5), (t) => t + ' %');
    svg.append('line').attr('x1', x(o.umbral)).attr('x2', x(o.umbral)).attr('y1', 0).attr('y2', alto).attr('stroke', 'var(--referencia)').attr('stroke-dasharray', '3 3');
    ord.forEach((r, i) => {
      const cy = arriba + i * fila + fila / 2, alta = r.asimetria >= o.umbral;
      svg.append('text').attr('x', 0).attr('y', cy + 4).attr('font-size', 13).attr('fill', 'var(--texto)').text(r.jugador);
      conTip(svg.append('rect').datum(r).attr('x', x(0)).attr('y', cy - 8).attr('height', 16).attr('rx', 4)
        .attr('width', Math.max(3, x(r.asimetria) - x(0))).attr('fill', alta ? 'var(--rojo)' : '#6b7280'),
        () => `${r.jugador} · ${o.nombre(r.periodo)}`, () => `Derecha ${nf(r.derecha, 1)} cm · Izquierda ${nf(r.izquierda, 1)} cm`);
      svg.append('text').attr('x', x(r.asimetria) + 8).attr('y', cy + 4).attr('font-size', 13).attr('fill', alta ? 'var(--mal)' : 'var(--texto-2)').text(nf(r.asimetria, 1) + ' %');
    });
  }

  /** Perfil carga-velocidad: una línea por fecha. filas: [{ periodo, carga, vmp }] */
  function perfil(box, filas, o) {
    if (!filas.length) return vacio(box, 'Sin mediciones de este ejercicio.');
    const h = 220, m = { t: 12, r: 16, b: 34, l: 40 };
    const c = lienzo(box, h);
    if (!c) return;
    const { svg, w } = c;
    const xe = d3.extent(filas, (r) => r.carga);
    const x = d3.scaleLinear([xe[0] - 5, xe[1] + 5], [m.l, w - m.r]);
    const y = d3.scaleLinear([0, Math.max(1, d3.max(filas, (r) => r.vmp) + 0.1)], [h - m.b, m.t]);
    for (const t of y.ticks(4)) {
      svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--grid)');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(nf(t, 1));
    }
    for (const t of x.ticks(Math.max(2, Math.floor((w - m.l - m.r) / 60)))) {
      svg.append('text').attr('x', x(t)).attr('y', h - m.b + 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(t);
    }
    svg.append('text').attr('x', w - m.r).attr('y', h - 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--texto-2)').text('kg');
    for (const [periodo, rs] of [...d3.group(filas, (r) => r.periodo)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const ord = [...rs].sort((a, b) => a.carga - b.carga);
      svg.append('path').datum(ord).attr('fill', 'none').attr('stroke', o.color(periodo)).attr('stroke-width', 2)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line((r) => x(r.carga), (r) => y(r.vmp)));
      conTip(svg.selectAll(null).data(ord).join('circle').attr('cx', (r) => x(r.carga)).attr('cy', (r) => y(r.vmp)).attr('r', 4.5)
        .attr('fill', o.color(periodo)).attr('stroke', 'var(--panel)').attr('stroke-width', 2),
        (r) => `${o.nombre(periodo)} · ${r.carga} kg`, (r) => `${nf(r.vmp, 2)} m/s`);
    }
  }

  /** Barras agrupadas por salto, una por fecha. filas: [{ periodo, test, altura }] */
  function saltos(box, filas, o) {
    if (!filas.length) return vacio(box, 'Sin saltos evaluados.');
    const TESTS = [['SJ', 'SJ'], ['CMJ', 'CMJ'], ['Abalakov', 'Abalakov'], ['CMJ D', 'CMJ der.'], ['CMJ I', 'CMJ izq.']];
    const h = 230, m = { t: 22, r: 8, b: 30, l: 32 };
    const c = lienzo(box, h);
    if (!c) return;
    const { svg, w } = c;
    const periodos = [...new Set(filas.map((r) => r.periodo))].sort();
    const tests = TESTS.filter(([t]) => filas.some((r) => r.test === t));
    const x0 = d3.scaleBand(tests.map(([t]) => t), [m.l, w - m.r]).paddingInner(0.25).paddingOuter(0.1);
    const x1 = d3.scaleBand(periodos, [0, x0.bandwidth()]).padding(0.12);
    const y = d3.scaleLinear([0, d3.max(filas, (r) => r.altura) * 1.12], [h - m.b, m.t]);
    for (const t of y.ticks(4)) {
      svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--grid)');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(t);
    }
    for (const [t, etiqueta] of tests) {
      svg.append('text').attr('x', x0(t) + x0.bandwidth() / 2).attr('y', h - m.b + 17).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('fill', 'var(--texto-2)').text(etiqueta);
      for (const p of periodos) {
        const r = filas.find((f) => f.test === t && f.periodo === p);
        if (!r) continue;
        const bw = Math.min(34, x1.bandwidth()), bx = x0(t) + x1(p) + (x1.bandwidth() - bw) / 2;
        conTip(svg.append('rect').datum(r).attr('x', bx).attr('width', bw).attr('y', y(r.altura)).attr('height', y(0) - y(r.altura)).attr('rx', 4).attr('fill', o.color(p)),
          () => `${etiqueta} · ${o.nombre(p)}`, () => `${nf(r.altura, 1)} cm`);
        if (bw >= 24) svg.append('text').attr('x', bx + bw / 2).attr('y', y(r.altura) - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--texto)').text(nf(r.altura, 1));
      }
    }
  }

  /** Barras por semana. filas: [{ semana: 'AAAA-MM-DD' (lunes), carga }] */
  function semanas(box, filas, o) {
    if (!filas.some((r) => r.carga)) return vacio(box, o.vacio || 'Sin carga registrada en estas semanas.');
    const h = 220, m = { t: 22, r: 8, b: 30, l: 44 };
    const c = lienzo(box, h);
    if (!c) return;
    const { svg, w } = c;
    const x = d3.scaleBand(filas.map((r) => r.semana), [m.l, w - m.r]).padding(0.3);
    const y = d3.scaleLinear([0, d3.max(filas, (r) => r.carga || 0) * 1.15], [h - m.b, m.t]);
    for (const t of y.ticks(4)) {
      svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--grid)');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(nf(t, 0));
    }
    const fecha = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
    const ultima = filas[filas.length - 1].semana;
    filas.forEach((r) => {
      svg.append('text').attr('x', x(r.semana) + x.bandwidth() / 2).attr('y', h - m.b + 17).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--texto-2)').text(fecha(r.semana));
      if (!r.carga) return;
      const bw = Math.min(40, x.bandwidth()), bx = x(r.semana) + (x.bandwidth() - bw) / 2;
      conTip(svg.append('rect').datum(r).attr('x', bx).attr('width', bw).attr('y', y(r.carga)).attr('height', y(0) - y(r.carga)).attr('rx', 4)
        .attr('fill', r.semana === ultima ? 'var(--rojo)' : '#6b7280'),
        () => `Semana del ${fecha(r.semana)}`, () => `${nf(r.carga, 0)} UA${r.jugadores ? ` · ${r.jugadores} jugadores` : ''}`);
      if (bw >= 26) svg.append('text').attr('x', bx + bw / 2).attr('y', y(r.carga) - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--texto)').text(nf(r.carga, 0));
    });
  }

  window.Graficos = { porJugador, asimetria, perfil, saltos, semanas, nf };
})();
