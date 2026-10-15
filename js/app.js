/**
 * La página: pide los datos al script de Google con la clave, los pasa por Calculos y dibuja cada pestaña.
 */
(function () {
  'use strict';

  const C = window.Calculos, G = window.Graficos, nf = G.nf;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const signo = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d);
  const tono = (v) => (v > 0 ? 'ok' : v < 0 ? 'mal' : 'neutro');
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  // Un color por evaluación, siempre en el mismo orden
  const COLORES = ['#7aa7ff', '#f5b841', '#f5f5f4', '#c084fc', '#2dd4bf', '#fb923c'];
  const TARJETAS = [
    ['Resistencia (VIFT)', 'Resistencia intermitente'],
    ['Sentadilla 80 kg', 'Fuerza tren inferior · sentadilla 80 kg'],
    ['Salto CMJ', 'Salto · CMJ'],
    ['Press plano 60 kg', 'Fuerza tren superior · press plano 60 kg'],
  ];
  const AREAS = [
    ['Resistencia intermitente', ['Resistencia (VIFT)']],
    ['Salto', ['Salto CMJ', 'Salto SJ']],
    ['Fuerza tren inferior', ['Sentadilla 80 kg', 'Sentadilla 100 kg']],
    ['Fuerza tren superior', ['Press plano 60 kg', 'Press plano 80 kg']],
  ];
  const PESTANAS = ['resumen', 'resistencia', 'saltos', 'fuerza', 'jugador', 'leer'];

  let M = null; // modelo calculado
  const estado = {
    pestana: 'resumen',
    jugador: null,
    salto: 'Salto CMJ',
    fuerza: 'Sentadilla 80 kg',
    pct: C.INTENSIDADES.includes(+leer('union-pct')) ? +leer('union-pct') : 90,
  };

  const color = (p) => COLORES[M.periodos.indexOf(p) % COLORES.length];
  const nombre = (p) => M.nombrePeriodo[p] || p;
  const opc = (ind) => ({ dec: C.INDICADOR[ind].dec, unidad: C.INDICADOR[ind].unidad, color, nombre });

  function leyenda(caja, periodos) {
    if (!caja) return;
    caja.replaceChildren(...periodos.map((p) => { const s = el('span'), i = el('i'); i.style.background = color(p); s.append(i, nombre(p)); return s; }));
  }
  const periodosDe = (filas) => [...new Set(filas.map((r) => r.periodo))].sort();

  // ---------- Resumen ----------
  function conclusion() {
    const caja = $('#conclusion');
    if (!M.equipo.length) { caja.textContent = 'Todavía no hay dos evaluaciones del mismo test para comparar.'; return; }
    const ord = [...M.equipo].sort((a, b) => b.cambio - a.cambio), mejor = ord[0], peor = ord[ord.length - 1];
    const partes = [`De ${nombre(mejor.desde).toLowerCase()} a ${nombre(mejor.hasta).toLowerCase()}, la mayor mejora del plantel fue en `,
      el('b', null, mejor.indicador), ` (${signo(mejor.cambio, 1)} %, promedio de ${mejor.jugadores} jugadores).`];
    if (peor !== mejor) partes.push(peor.cambio < 0 ? ' Bajó en ' : ' Donde menos mejoró: ', el('b', null, peor.indicador), ` (${signo(peor.cambio, 1)} %).`);
    caja.replaceChildren(...partes);
  }

  function resumen() {
    $('#tarjetas-resumen').replaceChildren(...TARJETAS.map(([ind, etiqueta]) => {
      const r = M.equipo.find((x) => x.indicador === ind), t = el('article', 'tarjeta dato');
      t.append(el('p', 'etiqueta', etiqueta));
      if (!r) { t.append(el('p', 'detalle', 'Sin dos evaluaciones para comparar')); return t; }
      const meta = C.INDICADOR[ind], n = el('p', 'numero ' + tono(r.cambio));
      n.append(signo(r.cambio, 1), el('small', null, '%'));
      t.append(n, el('p', 'detalle', `De ${nf(r.antes, meta.dec)} a ${nf(r.despues, meta.dec)} ${meta.unidad} · mejoraron ${r.mejoraron} de ${r.jugadores}`),
        el('p', 'detalle', `${nombre(r.desde)} → ${nombre(r.hasta)}`));
      return t;
    }));

    $('#tabla-equipo tbody').replaceChildren(...M.equipo.map((r) => {
      const meta = C.INDICADOR[r.indicador], tr = el('tr'), td = el('td');
      td.append(r.indicador, el('span', 'sub', `${nombre(r.desde)} → ${nombre(r.hasta)} · ${meta.unidad}`));
      tr.append(td, el('td', 'num', String(r.jugadores)), el('td', 'num', nf(r.antes, meta.dec)), el('td', 'num', nf(r.despues, meta.dec)),
        el('td', 'num ' + tono(r.cambio), signo(r.cambio, 1) + ' %'), el('td', 'num', `${r.mejoraron} de ${r.jugadores}`));
      return tr;
    }));
    $('#th-antes').textContent = 'Primera';
    $('#th-despues').textContent = 'Última';

    $('#tabla-alertas tbody').replaceChildren(...M.alertas.map((r) => {
      const tr = el('tr');
      tr.dataset.jugador = r.jugador;
      tr.tabIndex = 0;
      const td = el('td'); td.append(r.indicador, el('span', 'sub', nombre(r.periodo)));
      tr.append(el('td', null, r.jugador), el('td', 'mal', r.tipo), td, el('td', 'num mal', r.tipo === 'Bajó' ? signo(r.valor, 1) : nf(r.valor, 1)));
      return tr;
    }));
    $('#tabla-alertas').hidden = !M.alertas.length;
    $('#sin-alertas').hidden = !!M.alertas.length;
  }

  // ---------- Resistencia ----------
  function celdaDistancia(d, tarjeta) {
    const caja = el(tarjeta ? 'div' : 'td', tarjeta ? null : 'num');
    const arriba = el(tarjeta ? 'p' : 'div', tarjeta ? 'numero' : null);
    if (tarjeta) arriba.append(String(d.metros), el('small', null, 'm')); else arriba.append(el('b', null, String(d.metros)), ' m');
    const canchas = `${d.canchas} ${d.canchas === 1 ? 'cancha' : 'canchas'}${d.resto ? ` + ${d.resto} m` : ''}`;
    caja.append(arriba, el(tarjeta ? 'p' : 'span', tarjeta ? 'detalle' : 'sub', canchas));
    return caja;
  }

  function resistencia() {
    const filas = M.valores.filter((r) => r.indicador === 'Resistencia (VIFT)');
    leyenda($('#resistencia [data-leyenda]'), periodosDe(filas));
    G.porJugador($('#g-vift'), filas, opc('Resistencia (VIFT)'));
    const sel = $('#sel-pct');
    if (!sel.options.length) sel.append(...C.INTENSIDADES.map((p) => new Option(`${p} % de la VIFT`, p)));
    sel.value = String(estado.pct);
    const ultimas = [...M.vift.values()].sort((a, b) => b.valor - a.valor);
    $('#tabla-intervalos tbody').replaceChildren(...ultimas.map((r) => {
      const tr = el('tr');
      tr.append(el('td', null, r.jugador), el('td', 'num', nf(r.valor, 1)), el('td', null, nombre(r.periodo)),
        ...C.INTERVALOS.map((s) => celdaDistancia(C.distancia(r.valor, estado.pct, s))));
      return tr;
    }));
  }

  // ---------- Saltos y fuerza ----------
  function saltos() {
    $('#sel-salto').value = estado.salto;
    const filas = M.valores.filter((r) => r.indicador === estado.salto);
    leyenda($('#saltos [data-leyenda]'), periodosDe(filas));
    G.porJugador($('#g-salto'), filas, opc(estado.salto));
    // la última asimetría medida de cada jugador
    const ultimas = [...d3.group(M.asimetrias, (r) => r.jugador)].map(([, rs]) => rs.sort((a, b) => (a.periodo < b.periodo ? 1 : -1))[0]);
    const ps = periodosDe(ultimas);
    $('#nota-asimetria').textContent = 'Diferencia entre el salto con la pierna derecha y con la izquierda, como porcentaje de la pierna más fuerte. La franja marca entre 10 y 15 %, una zona orientativa.' +
      (ps.length ? ` Última medición: ${ps.map(nombre).join(' y ').toLowerCase()}.` : '');
    G.asimetria($('#g-asimetria'), ultimas, { umbral: C.UMBRAL_ASIMETRIA, nombre });
  }

  function fuerza() {
    $('#sel-fuerza').value = estado.fuerza;
    const filas = M.valores.filter((r) => r.indicador === estado.fuerza);
    leyenda($('#fuerza [data-leyenda]'), periodosDe(filas));
    G.porJugador($('#g-fuerza'), filas, opc(estado.fuerza));
  }

  // ---------- Hoja del jugador ----------
  function jugador() {
    const sel = $('#sel-jugador');
    if (sel.options.length !== M.jugadores.length) sel.replaceChildren(...M.jugadores.map((j) => new Option(j, j)));
    if (!M.jugadores.includes(estado.jugador)) estado.jugador = M.jugadores[0];
    sel.value = estado.jugador;
    const j = estado.jugador;
    const mios = M.valores.filter((r) => r.jugador === j);
    const cbs = M.cambios.filter((r) => r.jugador === j);
    $('#hoja-nombre').textContent = j;

    const mejoro = cbs.filter((r) => r.cambio > 0).map((r) => r.indicador), bajo = cbs.filter((r) => r.cambio < 0).map((r) => r.indicador);
    const partes = [];
    if (mejoro.length) partes.push('Mejoraste en ', el('b', null, mejoro.join(', ')), '. ');
    if (bajo.length) partes.push('Para seguir trabajando: ', el('b', null, bajo.join(', ')), '.');
    if (!cbs.length) partes.push('Todavía no tenés el mismo test en dos evaluaciones: la próxima va a mostrar tu evolución.');
    $('#hoja-resumen').replaceChildren(...partes);

    $('#hoja-areas').replaceChildren(...AREAS.map(([area, inds]) => {
      const t = el('article', 'tarjeta dato'), ind = inds.find((i) => mios.some((r) => r.indicador === i));
      if (!ind) { t.append(el('p', 'etiqueta', area), el('p', 'detalle', 'Sin evaluación todavía')); return t; }
      const meta = C.INDICADOR[ind], rs = mios.filter((r) => r.indicador === ind).sort((a, b) => (a.periodo < b.periodo ? -1 : 1)), u = rs[rs.length - 1];
      const n = el('p', 'numero'); n.append(nf(u.valor, meta.dec), el('small', null, meta.unidad));
      t.append(el('p', 'etiqueta', `${area} · ${ind.replace(/^Salto /, '').replace('Resistencia (VIFT)', 'VIFT')}`), n);
      const c = cbs.find((x) => x.indicador === ind), d1 = el('p', 'detalle');
      d1.append(nombre(u.periodo));
      if (c) d1.append(' · ', el('span', tono(c.cambio), `${c.cambio >= 0 ? 'mejoró' : 'bajó'} ${signo(c.cambio, 1)} % desde ${nombre(c.desde).toLowerCase()}`));
      t.append(d1);
      const pos = M.posiciones.find((x) => x.indicador === ind && x.jugador === j && x.periodo === u.periodo);
      if (pos) t.append(el('p', 'detalle', `Puesto ${pos.puesto} de ${pos.de} en el plantel`));
      return t;
    }));

    const v = M.vift.get(j);
    if (v) {
      const d = C.distancia(v.valor, estado.pct, 30);
      $('#hoja-int-nota').textContent = `Al ${estado.pct} % de tu VIFT (${nf(v.valor, 1)} km/h, test de ${nombre(v.periodo).toLowerCase()}), corriendo a ${nf(d.velocidad, 1)} km/h. Ida y vuelta sobre el largo de la cancha (28 m).`;
      $('#hoja-intervalos').replaceChildren(...C.INTERVALOS.map((s) => {
        const t = el('article', 'tarjeta dato');
        t.append(el('p', 'etiqueta', `${s}" de trabajo × ${s}" de pausa`), celdaDistancia(C.distancia(v.valor, estado.pct, s), true));
        return t;
      }));
    } else {
      $('#hoja-int-nota').textContent = 'No tiene test 30-15, así que todavía no hay distancias para calcular.';
      $('#hoja-intervalos').replaceChildren();
    }

    const ps = M.periodos;
    const head = el('tr');
    head.append(el('th', null, 'Test'), ...ps.map((p) => el('th', 'num', nombre(p))), el('th', 'num', 'Cambio'));
    $('#hoja-tabla thead').replaceChildren(head);
    $('#hoja-tabla tbody').replaceChildren(...C.INDICADORES.filter((i) => mios.some((r) => r.indicador === i.id)).map((i) => {
      const tr = el('tr');
      tr.append(el('td', null, `${i.id} (${i.unidad})`));
      for (const p of ps) {
        const r = mios.find((x) => x.indicador === i.id && x.periodo === p);
        tr.append(el('td', 'num' + (r ? '' : ' neutro'), r ? nf(r.valor, i.dec) : '—'));
      }
      const c = cbs.find((x) => x.indicador === i.id);
      tr.append(el('td', 'num ' + (c ? tono(c.cambio) : 'neutro'), c ? signo(c.cambio, 1) + ' %' : '—'));
      return tr;
    }));

    for (const [id, ej] of [['#g-perfil-s', 'Sentadilla media'], ['#g-perfil-p', 'Press plano']]) {
      const filas = M.encoder.filter((r) => r.jugador === j && r.ejercicio === ej);
      leyenda($(id).parentElement.querySelector('[data-leyenda]'), periodosDe(filas));
      G.perfil($(id), filas, { color, nombre });
    }
    const sj = M.mejores.filter((r) => r.jugador === j);
    leyenda($('#g-saltos-j').parentElement.querySelector('[data-leyenda]'), periodosDe(sj));
    G.saltos($('#g-saltos-j'), sj, { color, nombre });
  }

  // ---------- Navegación ----------
  const DIBUJAR = { resumen, resistencia, saltos, fuerza, jugador, leer: () => {} };
  function dibujar() { if (M) DIBUJAR[estado.pestana](); }

  function mostrarPestana(p, desdeHash) {
    if (!PESTANAS.includes(p)) p = 'resumen';
    estado.pestana = p;
    document.querySelectorAll('.pestana').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === p)));
    PESTANAS.forEach((id) => { document.getElementById(id).hidden = id !== p; });
    if (!desdeHash && location.hash.slice(1) !== p) history.replaceState(null, '', location.pathname + location.search + '#' + p);
    dibujar();
  }

  document.querySelectorAll('.pestana').forEach((b) => b.addEventListener('click', () => mostrarPestana(b.dataset.tab)));
  window.addEventListener('hashchange', () => mostrarPestana(location.hash.slice(1), true));
  $('#sel-salto').addEventListener('change', (e) => { estado.salto = e.target.value; dibujar(); });
  $('#sel-fuerza').addEventListener('change', (e) => { estado.fuerza = e.target.value; dibujar(); });
  $('#sel-pct').addEventListener('change', (e) => { estado.pct = +e.target.value; guardar('union-pct', estado.pct); dibujar(); });
  $('#sel-jugador').addEventListener('change', (e) => { estado.jugador = e.target.value; dibujar(); });

  const abrirJugador = (tr) => { if (!tr) return; estado.jugador = tr.dataset.jugador; mostrarPestana('jugador'); window.scrollTo(0, 0); };
  $('#tabla-alertas tbody').addEventListener('click', (e) => abrirJugador(e.target.closest('tr[data-jugador]')));
  $('#tabla-alertas tbody').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirJugador(e.target.closest('tr[data-jugador]')); });

  function presentar(si) {
    document.body.classList.toggle('presentando', si);
    $('#btn-salir').hidden = !si;
    const fs = document.fullscreenElement;
    if (si && !fs && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!si && fs && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    window.scrollTo(0, 0);
    requestAnimationFrame(dibujar);
  }
  $('#btn-presentar').addEventListener('click', () => presentar(true));
  $('#btn-salir').addEventListener('click', () => presentar(false));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('presentando')) presentar(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('presentando')) presentar(false); });

  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(dibujar, 150); });

  // ---------- Datos ----------
  const params = new URLSearchParams(location.search);
  const demo = params.has('demo');
  let clave = params.get('c');
  if (clave) {
    guardar('union-clave', clave);
    params.delete('c');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  } else clave = leer('union-clave');

  function iniciar(datos, cuando) {
    M = C.preparar(datos);
    $('#cargando').hidden = true;
    $('#acceso').hidden = true;
    $('#app').hidden = false;
    $('#chip-demo').hidden = !demo;
    const u = M.periodos[M.periodos.length - 1];
    $('#chip-ultima').textContent = u ? `Última evaluación: ${nombre(u).toLowerCase()} ${u.slice(0, 4)}` : 'Sin evaluaciones';
    if (cuando) {
      $('#estado').hidden = false;
      $('#actualizado').textContent = `Datos de ${new Date(cuando).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    }
    conclusion();
    mostrarPestana(location.hash.slice(1) || estado.pestana, true);
  }

  function pedirClave(error) {
    $('#cargando').hidden = true;
    $('#app').hidden = true;
    $('#acceso').hidden = false;
    $('#acceso-error').hidden = !error;
    $('#acceso-error').textContent = error || '';
    $('#clave').focus();
  }
  function entrar() {
    const v = $('#clave').value.trim();
    if (!v) return;
    clave = v;
    guardar('union-clave', v);
    cargar(true);
  }
  $('#btn-entrar').addEventListener('click', entrar);
  $('#clave').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });

  async function cargar(fresco) {
    if (demo) {
      const r = await fetch('datos/ejemplo.json');
      return iniciar(await r.json());
    }
    if (!window.CONFIG.API_URL) return pedirClave('La página todavía no está conectada a la planilla. Mientras tanto podés ver un ejemplo agregando ?demo al link.');
    if (!clave) return pedirClave();

    const llave = 'union-datos';
    if (!fresco && !M) {
      try {
        const g = JSON.parse(leer(llave));
        if (g && g.clave === clave && g.datos) iniciar(g.datos, g.generado);
      } catch (e) { /* nada guardado */ }
    }
    const boton = $('#btn-actualizar');
    boton.disabled = true;
    boton.textContent = 'Actualizando…';
    try {
      const url = `${window.CONFIG.API_URL}?accion=evaluaciones&clave=${encodeURIComponent(clave)}${fresco ? '&fresco=1' : ''}`;
      const r = await fetch(url, { referrerPolicy: 'no-referrer', credentials: 'omit' });
      const j = await r.json();
      if (!j.ok) {
        if (j.error === 'clave') { guardar('union-clave', null); guardar(llave, null); clave = null; M = null; return pedirClave('Esa clave no es válida.'); }
        throw new Error(j.error || 'respuesta inválida');
      }
      guardar(llave, JSON.stringify({ clave, datos: j.datos, generado: j.generado }));
      iniciar(j.datos, j.generado);
    } catch (e) {
      const detalle = e instanceof SyntaxError ? 'el script de Google no devolvió datos (revisá que la implementación tenga acceso para "Cualquier persona")' : (e && e.message) || 'sin conexión';
      if (!M) { $('#cargando').textContent = `No se pudieron cargar los datos: ${detalle}. Recargá la página para reintentar.`; $('#cargando').hidden = false; }
      else $('#actualizado').textContent = 'No se pudo actualizar: se muestran los últimos datos guardados';
    } finally {
      boton.disabled = false;
      boton.textContent = 'Actualizar';
    }
  }
  $('#btn-actualizar').addEventListener('click', () => cargar(true));
  cargar(false);
})();
