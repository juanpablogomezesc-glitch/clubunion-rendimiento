/**
 * La página: pide los datos al script de Google con la clave, los pasa por Calculos y dibuja cada pestaña.
 */
(function () {
  'use strict';

  const C = window.Calculos, G = window.Graficos, K = window.Carga, P = window.Partidos, nf = G.nf;
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
  const PESTANAS = ['resumen', 'resistencia', 'saltos', 'fuerza', 'carga', 'partidos', 'jugador', 'leer'];

  let M = null; // modelo calculado
  let CG = null; // carga calculada
  let PT = { est: [], partidos: [], promedios: [] }; // estadísticas de partido
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

  // ---------- Carga ----------
  const fechaCorta = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

  function carga() {
    $('#carga-error').hidden = !CG.error;
    $('#carga-error').textContent = CG.error ? `No se pudo leer la planilla CARGA PRIMERA: ${CG.error}` : '';
    $('#carga-vacio').hidden = !CG.vacio || !!CG.error;
    $('#carga-form').hidden = !CG.formulario;
    $('#link-form').value = CG.formulario || '';
    for (const id of ['#tarjetas-carga', '#carga-equipo-tarjeta', '#carga-dias-tarjeta', '#carga-jugadores-tarjeta']) $(id).hidden = CG.vacio;
    if (CG.error) return;
    sesionesYNovedades();
    if (CG.vacio) return;

    const tarjeta = (etiqueta, numero, unidad, detalle, cls) => {
      const t = el('article', 'tarjeta dato'), n = el('p', 'numero' + (cls ? ' ' + cls : ''));
      n.append(numero);
      if (unidad) n.append(el('small', null, unidad));
      t.append(el('p', 'etiqueta', etiqueta), n);
      if (detalle) t.append(el('p', 'detalle', detalle));
      return t;
    };
    const u = CG.ultimoPartido;
    $('#tarjetas-carga').replaceChildren(
      tarjeta('Carga del equipo · últimos 7 días', CG.carga7 != null ? nf(CG.carga7, 0) : '—', 'UA',
        (CG.cambio7 != null ? `${signo(CG.cambio7, 1)} % contra los 7 días anteriores · promedio por jugador` : 'Promedio por jugador') +
        (CG.estimadas ? ' · partidos sin formulario estimados' : '')),
      tarjeta('Sesiones · últimos 7 días', String(CG.sesiones7), null, 'Cargadas en la pestaña Sesiones'),
      tarjeta('Formulario respondido', CG.cumplimiento != null ? String(CG.cumplimiento) : '—', CG.cumplimiento != null ? '%' : null,
        'De las sesiones de los últimos 14 días', CG.cumplimiento != null && CG.cumplimiento < 70 ? 'aviso' : null),
      tarjeta('Último partido', u ? u.rival || fechaCorta(u.fecha) : '—', null, u ? `${fechaCorta(u.fecha)} · jugaron ${u.jugaron}` : 'Todavía no hay partidos cargados'),
    );
    G.semanas($('#g-carga-equipo'), CG.equipoSemanal, {});
    G.leyendaTipos($('#ley-carga-equipo'), CG.equipoSemanal);
    G.semanas($('#g-carga-dias'), CG.equipoDiario, { dias: true, vacio: 'Sin carga en las últimas 2 semanas.' });
    G.leyendaTipos($('#ley-carga-dias'), CG.equipoDiario);
    $('#nota-carga-equipo').textContent = 'Promedio por jugador de RPE × minutos (UA), de lunes a domingo, Primera y U21 juntas, separado por tipo de sesión. La barra recuadrada es la semana en curso. Tocá una barra para ver el detalle.' +
      (CG.estimadas ? ` Si un jugador no completó el formulario de un partido, se usan sus minutos × RPE ${nf(CG.rpeEstimado, 1)}.` : '');
    minutosPartido();

    const conDatos = CG.jugadores.filter((j) => j.aguda != null || j.cronica != null || j.minutosTotal || j.ultimoPartido);
    const orden = [...conDatos].sort((a, b) => (b.relacion || 0) - (a.relacion || 0) || (b.aguda || 0) - (a.aguda || 0));
    $('#tabla-carga tbody').replaceChildren(...orden.map((j) => {
      const tr = el('tr');
      tr.dataset.jugador = j.jugador;
      tr.tabIndex = 0;
      const rel = el('td', 'num');
      if (j.relacion != null) rel.append(el('span', 'pill ' + j.estado.tono, `${nf(j.relacion, 2)} · ${j.estado.nombre}`));
      else rel.append(el('span', 'neutro', 'Faltan semanas'));
      const ult = el('td', 'num');
      if (j.ultimoPartido) ult.append(`${nf(j.ultimoPartido.minutos, 0)} min`, el('span', 'sub', `${j.ultimoPartido.rival} · ${fechaCorta(j.ultimoPartido.fecha)}`));
      else ult.append(el('span', 'neutro', '—'));
      tr.append(el('td', null, j.jugador),
        (() => { const td = el('td', 'num' + (j.aguda == null ? ' neutro' : ''), j.aguda != null ? nf(j.aguda, 0) : '—'); if (j.estimada7) td.append(el('span', 'sub', 'con partido estimado')); return td; })(),
        el('td', 'num' + (j.cronica == null ? ' neutro' : ''), j.cronica != null ? nf(j.cronica, 0) : '—'),
        rel,
        el('td', 'num' + (j.rpe7 == null ? ' neutro' : ''), j.rpe7 != null ? nf(j.rpe7, 1) : '—'),
        el('td', 'num', j.minutosTotal ? nf(j.minutosTotal, 0) : '—'),
        ult);
      return tr;
    }));
  }

  function minutosPartido() {
    const mp = CG.minutosPartido || { partidos: [], filas: [] };
    $('#minutos-tarjeta').hidden = !mp.filas.length;
    if (!mp.filas.length) return;
    const tope = Math.max(...mp.filas.flatMap((f) => f.minutos.map((m) => m || 0)), 1);
    const cab = el('tr');
    cab.append(el('th', null, 'Jugador'), ...mp.partidos.map((p) => {
      const th = el('th', 'num');
      th.append(fechaCorta(p.fecha), el('span', 'sub', `${p.categoria === 'Primera' ? '' : p.categoria + ' · '}${String(p.rival).replace(/\s*\(U\d{2}\)\s*$/i, '')}`));
      return th;
    }), el('th', 'num', 'Total'));
    $('#tabla-minutos thead').replaceChildren(cab);
    $('#tabla-minutos tbody').replaceChildren(...mp.filas.map((f) => {
      const tr = el('tr');
      tr.append(el('td', null, f.jugador), ...f.minutos.map((m) => {
        if (m == null) return el('td', 'num neutro', '');
        const td = el('td', 'num celda-min', m > 0 ? nf(m, 0) : '0');
        if (m > 0) td.style.setProperty('--n', String(Math.round((100 * m) / tope)));
        return td;
      }), el('td', 'num total', nf(f.total, 0)));
      return tr;
    }));
  }

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const conDia = (f) => `${DIAS[new Date(f + 'T12:00:00Z').getUTCDay()]} ${fechaCorta(f)}`;

  async function enviar(datos) {
    const r = await fetch(window.CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ ...datos, clave }), credentials: 'omit', referrerPolicy: 'no-referrer' });
    return r.json();
  }

  function sesionesYNovedades() {
    const nov = CG.novedades || [];
    $('#novedades-tarjeta').hidden = !nov.length;
    $('#novedades').replaceChildren(...nov.map((n) => el('li', null, (n.fecha ? fechaCorta(n.fecha) + ' · ' : '') + n.texto)));
    const ses = CG.sesionesRecientes || [];
    $('#sesiones-tarjeta').hidden = !ses.length;
    $('#tabla-sesiones tbody').replaceChildren(...ses.map((x) => {
      const tr = el('tr'), td = el('td', 'num'), caja = el('span', 'duracion');
      const input = el('input'); input.type = 'number'; input.min = '1'; input.max = '300'; input.value = String(x.duracion);
      input.setAttribute('aria-label', `Duración de ${x.tipo} del ${fechaCorta(x.fecha)}`);
      const b = el('button', 'boton', 'Guardar'); b.type = 'button'; b.disabled = true;
      input.addEventListener('input', () => { b.disabled = !(+input.value > 0 && +input.value <= 300) || +input.value === x.duracion; });
      b.addEventListener('click', async () => {
        if (demo) { b.textContent = 'Ejemplo'; return; }
        b.disabled = true; b.textContent = 'Guardando…';
        try {
          const j = await enviar({ accion: 'duracion', fecha: x.fecha, tipo: x.tipo, duracion: +input.value });
          if (!j.ok) throw new Error(j.error);
          b.textContent = 'Guardado';
          cargar(true);
        } catch (e) { b.textContent = 'Reintentar'; b.disabled = false; }
      });
      caja.append(input, b);
      td.append(caja);
      const tipo = el('td'); tipo.append(x.tipo);
      tipo.append(el('span', 'sub', `${x.respuestas} ${x.respuestas === 1 ? 'respondió' : 'respondieron'}${x.automatica ? ' · duración habitual' : ''}`));
      const dia = el('td'); dia.append(conDia(x.fecha).split(' ')[0], el('span', 'sub', fechaCorta(x.fecha)));
      tr.append(dia, tipo, td);
      return tr;
    }));
  }

  $('#pdf-partido').addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0], estado = $('#subir-estado');
    e.target.value = '';
    if (!archivo) return;
    if (demo) { estado.textContent = 'En la vista de ejemplo no se suben archivos.'; return; }
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') { estado.textContent = 'Tiene que ser el PDF de estadísticas de la CABB.'; return; }
    $('#btn-pdf').textContent = 'Leyendo la planilla…';
    estado.textContent = 'Subiendo y leyendo el PDF. Tarda unos segundos.';
    try {
      const datos = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(archivo); });
      const j = await enviar({ accion: 'subirPdf', nombre: archivo.name, datos });
      if (!j.ok) throw new Error(j.error);
      const p = (j.resultado.planillas || [])[0];
      if (!p) estado.textContent = 'Se subió, pero no había nada nuevo para leer.';
      else if (p.error) estado.textContent = p.error;
      else {
        estado.textContent = `Listo: ${p.rival} (${p.local ? 'local' : 'visitante'}), ${fechaCorta(p.fecha)}, ${p.jugadores} jugadores.` +
          (p.nuevos.length ? ` Jugadores nuevos: ${p.nuevos.join(', ')}.` : '') +
          (p.fechaDudosa ? ' Nadie respondió el formulario como "Partido" esa semana, así que la fecha es la de hoy: corregila en Sesiones si hace falta.' : '');
        cargar(true);
      }
    } catch (err) {
      estado.textContent = `No se pudo cargar: ${err.message || 'sin conexión'}.`;
    } finally {
      $('#btn-pdf').textContent = 'Elegir PDF';
    }
  });

  function cargaJugador(j) {
    const caja = $('#hoja-carga');
    const d = CG && !CG.vacio ? CG.jugadores.find((x) => x.jugador === j) : null;
    caja.hidden = !d || (!d.semanal.some((s) => s.carga) && !d.minutosTotal);
    if (caja.hidden) return;
    const partes = [];
    if (d.aguda != null) partes.push(`Últimos 7 días: ${nf(d.aguda, 0)} UA${d.relacion != null ? ` (${nf(d.relacion, 2)} veces tu promedio semanal)` : ''}.`);
    if (d.partidosJugados) partes.push(`Minutos en partidos: ${nf(d.minutosTotal, 0)} en ${d.partidosJugados} ${d.partidosJugados === 1 ? 'partido' : 'partidos'} (promedio ${nf(d.minutosPromedio, 1)}).`);
    $('#hoja-carga-nota').textContent = partes.join(' ') || 'RPE × minutos de cada semana, de lunes a domingo.';
    G.semanas($('#g-carga-j'), d.semanal, { vacio: 'Sin carga en estas semanas.' });
    G.leyendaTipos($('#ley-carga-j'), d.semanal);
  }

  // ---------- Partidos ----------
  const tiro = (c, i) => `${c}/${i}`;
  const conSigno = (v) => (v > 0 ? '+' : '') + v;

  function partidos() {
    const hay = PT.partidos.length > 0;
    $('#partidos-vacio').hidden = hay;
    $('#partidos-contenido').hidden = !hay;
    if (!hay) return;

    // categoría: Primera, U21... (los partidos y los promedios se ven por separado)
    const cats = [...new Set(PT.partidos.map((p) => p.categoria))].sort((a, b) => (a === 'Primera' ? -1 : b === 'Primera' ? 1 : a.localeCompare(b)));
    if (!cats.includes(estado.categoria)) estado.categoria = cats[0];
    const selC = $('#sel-categoria');
    if (selC.options.length !== cats.length) selC.replaceChildren(...cats.map((c) => new Option(c, c)));
    selC.value = estado.categoria;
    $('#control-categoria').hidden = cats.length < 2;

    const lista = PT.partidos.filter((p) => p.categoria === estado.categoria);
    const sel = $('#sel-partido');
    const ids = lista.map((p) => p.id);
    sel.replaceChildren(...lista.map((p) => new Option(`${fechaCorta(p.fecha)} · ${p.local ? 'vs' : 'en'} ${p.rival}${p.fechaDudosa ? ' (fecha a confirmar)' : ''}`, p.id)));
    if (!ids.includes(estado.partido)) estado.partido = ids[0];
    sel.value = estado.partido;
    const p = lista.find((x) => x.id === estado.partido), t = p.totales;

    const m = $('#marcador'), eq = el('div', 'equipos');
    const propio = el('span', 'equipo', 'Unión'), riv = el('span', 'equipo', p.rival);
    const marcador = (a, b) => el('span', 'tanteador', b != null ? `${a} – ${b}` : `${a}`);
    if (p.local) eq.append(propio, marcador(p.puntosEquipo, p.puntosRival), riv); else eq.append(riv, marcador(p.puntosRival != null ? p.puntosRival : p.puntosEquipo, p.puntosRival != null ? p.puntosEquipo : null), propio);
    const info = el('div');
    info.append(el('p', 'etiqueta', `${p.categoria} · ${p.local ? 'Local' : 'Visitante'} · ${conDia(p.fecha)}`));
    if (p.resultado) info.append(el('p', 'numero ' + (p.resultado === 'Ganó' ? 'ok' : p.resultado === 'Perdió' ? 'mal' : 'neutro'), p.resultado));
    if (p.fechaDudosa && p.archivo) {
      const caja = el('div', 'fecha-dudosa'), input = el('input'), b = el('button', 'boton', 'Guardar fecha');
      input.type = 'date'; input.value = p.fecha; input.setAttribute('aria-label', 'Fecha del partido');
      b.type = 'button';
      b.addEventListener('click', async () => {
        if (demo) { b.textContent = 'Ejemplo'; return; }
        if (!input.value) return;
        b.disabled = true; b.textContent = 'Guardando…';
        try {
          const r = await enviar({ accion: 'fechaPartido', archivo: p.archivo, nueva: input.value });
          if (!r.ok) throw new Error(r.error);
          b.textContent = 'Guardada';
          cargar(true);
        } catch (err) { b.disabled = false; b.textContent = 'Reintentar'; }
      });
      caja.append('Fecha a confirmar (la planilla no la trae):', input, b);
      info.append(caja);
    }
    info.className = 'dato';
    m.replaceChildren(eq, info);

    const dato = (etiqueta, numero, detalle) => {
      const d = el('article', 'tarjeta dato');
      d.append(el('p', 'etiqueta', etiqueta), el('p', 'numero', numero));
      if (detalle) d.append(el('p', 'detalle', detalle));
      return d;
    };
    $('#tarjetas-partido').replaceChildren(...(p.completo ? [
      dato('Tiros de 2', t.p2 != null ? `${t.p2} %` : '—', tiro(t.t2c, t.t2i)),
      dato('Tiros de 3', t.p3 != null ? `${t.p3} %` : '—', tiro(t.t3c, t.t3i)),
      dato('Libres', t.ptl != null ? `${t.ptl} %` : '—', tiro(t.tlc, t.tli)),
      dato('Rebotes', String(t.rebTot), `${t.rebOf} ofensivos`),
      dato('Asistencias', String(t.asistencias), `${t.perdidas} pérdidas`),
      dato('Recuperos', String(t.recuperos), `${t.faltas} faltas`),
    ] : [
      dato('Dobles convertidos', String(t.t2c)),
      dato('Triples convertidos', String(t.t3c)),
      dato('Libres', t.ptl != null ? `${t.ptl} %` : '—', tiro(t.tlc, t.tli)),
      dato('Faltas', String(t.faltas)),
    ]));
    $('#nota-partido').textContent = p.completo ? '★ titular. Tiros: convertidos/intentados.'
      : '★ titular. Esta planilla trae estadísticas básicas: puntos, tiros convertidos, libres y faltas (no trae rebotes, asistencias ni tiros errados).';

    const cols = p.completo
      ? ['Min', 'Pts', '2P', '3P', 'TL', 'Reb', 'Ast', 'Rec', 'Pér', 'Val', '+/-']
      : ['Min', 'Pts', 'Dobles', 'Triples', 'TL', 'Faltas', 'Val', '+/-'];
    const head = el('tr');
    head.append(el('th', null, 'Jugador'), ...cols.map((c) => el('th', 'num', c)));
    $('#tabla-partido thead').replaceChildren(head);
    const maxPts = Math.max(...p.jugadores.map((j) => j.puntos));
    $('#tabla-partido tbody').replaceChildren(...p.jugadores.map((j) => {
      const tr = el('tr'), nom = el('td');
      tr.dataset.jugador = j.jugador; tr.tabIndex = 0;
      if (j.titular) nom.append(el('span', 'estrella', '★'));
      nom.append(j.jugador);
      const n = (v) => el('td', 'num', String(v));
      const pts = el('td', 'num' + (j.puntos === maxPts && maxPts > 0 ? ' ok' : ''), String(j.puntos));
      const mm = el('td', 'num ' + tono(j.masMenos), conSigno(j.masMenos));
      const fila = j.minutos <= 0 ? [el('td', 'num neutro', 'No jugó'), ...Array.from({ length: cols.length - 1 }, () => el('td', 'num neutro', ''))]
        : p.completo
          ? [n(nf(j.minutos, 0)), pts, n(tiro(j.t2c, j.t2i)), n(tiro(j.t3c, j.t3i)), n(tiro(j.tlc, j.tli)), n(j.rebTot), n(j.asistencias), n(j.recuperos), n(j.perdidas), n(j.valoracion), mm]
          : [n(nf(j.minutos, 0)), pts, n(j.t2c), n(j.t3c), n(tiro(j.tlc, j.tli)), n(j.faltas), n(j.valoracion), mm];
      tr.append(nom, ...fila);
      return tr;
    }));

    const prom = P.promedios(PT.est, estado.categoria);
    const algunoCompleto = lista.some((x) => x.completo);
    $('#titulo-promedios').textContent = `Promedios del torneo · ${estado.categoria}`;
    $('#nota-promedios').textContent = `${lista.length} ${lista.length === 1 ? 'partido cargado' : 'partidos cargados'}. Por partido jugado (los partidos sin minutos no cuentan).` +
      (algunoCompleto ? ' Rebotes, asistencias y porcentajes de 2 y 3, solo de las planillas que los traen.' : ' Las planillas de esta categoría no traen rebotes, asistencias ni tiros errados.');
    const colsP = algunoCompleto ? ['PJ', 'Min', 'Pts', 'Reb', 'Ast', 'Val', '2P %', '3P %', 'TL %'] : ['PJ', 'Min', 'Pts', 'Triples', 'Val', 'TL %'];
    const headP = el('tr');
    headP.append(el('th', null, 'Jugador'), ...colsP.map((c) => el('th', 'num', c)));
    $('#tabla-promedios thead').replaceChildren(headP);
    $('#tabla-promedios tbody').replaceChildren(...prom.filter((r) => r.jugados).map((r) => {
      const tr = el('tr'); tr.dataset.jugador = r.jugador; tr.tabIndex = 0;
      const c = (v, d) => el('td', 'num' + (v == null ? ' neutro' : ''), v == null ? '—' : d == null ? String(v) : nf(v, d));
      tr.append(el('td', null, r.jugador), c(r.jugados), c(r.minutos, 1), c(r.puntos, 1),
        ...(algunoCompleto ? [c(r.rebotes, 1), c(r.asistencias, 1), c(r.valoracion, 1), c(r.p2), c(r.p3), c(r.ptl)] : [c(r.triples, 1), c(r.valoracion, 1), c(r.ptl)]));
      return tr;
    }));
  }

  function partidosJugador(j) {
    const filas = PT.est.filter((r) => r.jugador === j);
    $('#hoja-partidos').hidden = !filas.length;
    if (!filas.length) return;
    const cats = [...new Set(filas.map((r) => r.categoria || 'Primera'))];
    const dato = (etiqueta, numero) => { const d = el('article', 'tarjeta dato'); d.append(el('p', 'etiqueta', etiqueta), el('p', 'numero', numero)); return d; };
    const partes = [], tarjetas = [];
    for (const cat of cats) {
      const r = P.promedios(PT.est, cat).find((x) => x.jugador === j);
      if (!r) continue;
      partes.push(r.jugados ? `${cat}: ${r.jugados} ${r.jugados === 1 ? 'partido jugado' : 'partidos jugados'} de ${r.convocado}.` : `${cat}: convocado a ${r.convocado}, sin minutos.`);
      if (r.jugados) tarjetas.push(dato(`${cat} · minutos`, nf(r.minutos, 1)), dato(`${cat} · puntos`, nf(r.puntos, 1)));
    }
    const ult = PT.partidos.map((p) => ({ p, f: p.jugadores.find((x) => x.jugador === j) })).find((x) => x.f && x.f.minutos > 0);
    if (ult) partes.push(`Último: ${ult.f.puntos} puntos en ${nf(ult.f.minutos, 0)} minutos ${ult.p.local ? 'contra' : 'en cancha de'} ${ult.p.rival} (${ult.p.categoria}).`);
    $('#hoja-partidos-nota').textContent = partes.join(' ') + ' Promedios por partido jugado.';
    $('#hoja-partidos-datos').replaceChildren(...tarjetas);
  }

  // ---------- Hoja del jugador ----------
  function jugador() {
    const sel = $('#sel-jugador');
    // todos: los evaluados, los que tienen carga y los que jugaron partidos
    const todos = [...new Set([...M.jugadores, ...(CG && !CG.vacio ? CG.jugadores.map((x) => x.jugador) : []), ...PT.promedios.map((x) => x.jugador)])].sort((a, b) => a.localeCompare(b, 'es'));
    if (sel.options.length !== todos.length) sel.replaceChildren(...todos.map((j) => new Option(j, j)));
    if (!todos.includes(estado.jugador)) estado.jugador = todos[0];
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
    cargaJugador(j);
    partidosJugador(j);
    const sj = M.mejores.filter((r) => r.jugador === j);
    leyenda($('#g-saltos-j').parentElement.querySelector('[data-leyenda]'), periodosDe(sj));
    G.saltos($('#g-saltos-j'), sj, { color, nombre });
  }

  // ---------- Navegación ----------
  const DIBUJAR = { resumen, resistencia, saltos, fuerza, carga, partidos, jugador, leer: () => {} };
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
  $('#tabla-carga tbody').addEventListener('click', (e) => abrirJugador(e.target.closest('tr[data-jugador]')));
  for (const id of ['#tabla-partido tbody', '#tabla-promedios tbody']) {
    $(id).addEventListener('click', (e) => abrirJugador(e.target.closest('tr[data-jugador]')));
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirJugador(e.target.closest('tr[data-jugador]')); });
  }
  $('#sel-partido').addEventListener('change', (e) => { estado.partido = e.target.value; dibujar(); });
  $('#sel-categoria').addEventListener('change', (e) => { estado.categoria = e.target.value; estado.partido = null; dibujar(); });
  $('#tabla-carga tbody').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirJugador(e.target.closest('tr[data-jugador]')); });
  $('#btn-copiar').addEventListener('click', () => {
    const i = $('#link-form');
    const listo = () => { $('#btn-copiar').textContent = 'Copiado'; setTimeout(() => { $('#btn-copiar').textContent = 'Copiar'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(i.value).then(listo, () => { i.select(); });
    else i.select();
  });
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
    const hoy = demo && datos.carga ? K.ultimaFecha(datos.carga) : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    CG = K.preparar(datos.carga, hoy || new Date().toISOString().slice(0, 10));
    const est = (datos.carga && datos.carga.estadisticas) || [];
    PT = { est, partidos: P.partidos(est), promedios: P.promedios(est) };
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
      $('#aviso-script').hidden = !!j.version && j.version >= (window.CONFIG.VERSION_SCRIPT || '');
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
