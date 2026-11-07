/* GeoMaster · Comunidades autónomas de España
 * Juego sin dependencias. Los datos del mapa están en js/map-data.js (window.MAP_DATA).
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA = window.MAP_DATA;
  const CITIES = ['18', '19']; // Ceuta y Melilla

  // Colores de las comunidades ya descubiertas (vecinas con colores distintos).
  const COLORS = {
    '01': '#8fd18b', '02': '#f6c85f', '03': '#7cc6e8', '04': '#f49ac1', '05': '#ffb067',
    '06': '#c3a6f2', '07': '#ffd98a', '08': '#9fd8c9', '09': '#f7a19a', '10': '#a8c7ff',
    '11': '#d3b98a', '12': '#b5e48c', '13': '#ff8fa3', '14': '#e2c2ff', '15': '#86e3c3',
    '16': '#ffc48a', '17': '#8ec5ff', '18': '#ff9f80', '19': '#ff9f80'
  };

  // Etiquetas del mapa (líneas y, si hace falta, posición o tamaño propios).
  const LABELS = {
    '01': { t: ['Andalucía'] },
    '02': { t: ['Aragón'] },
    '03': { t: ['Asturias'], s: 13 },
    '04': { t: ['Islas', 'Baleares'], x: 880, y: 440, s: 14 },
    '05': { t: ['Canarias'], x: 107, y: 652, s: 14 },
    '06': { t: ['Cantabria'], s: 12 },
    '07': { t: ['Castilla', 'y León'] },
    '08': { t: ['Castilla-', 'La Mancha'] },
    '09': { t: ['Cataluña'] },
    '10': { t: ['Comunidad', 'Valenciana'], x: 632, y: 418, s: 14 },
    '11': { t: ['Extremadura'] },
    '12': { t: ['Galicia'] },
    '13': { t: ['Madrid'], s: 13 },
    '14': { t: ['Murcia'], s: 14 },
    '15': { t: ['Navarra'], s: 14 },
    '16': { t: ['País', 'Vasco'], s: 12 },
    '17': { t: ['La Rioja'], s: 11 },
    '18': { t: ['Ceuta'], x: 262, y: 724, s: 13 },
    '19': { t: ['Melilla'], x: 512, y: 768, s: 13 }
  };

  const PROMPT_TEXT = {
    which: '¿Qué comunidad está marcada en el mapa?',
    where: (name) => `¿Dónde está <span class="name">${name}</span>? Tócala en el mapa`
  };

  // ---------- Estado ----------
  const settings = { mode: 'which', time: 5, cities: true, sound: true };
  let state = null;
  let timer = { raf: 0, start: 0, duration: 0, paused: false, elapsedBeforePause: 0 };
  let nextTimeout = 0;

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const svg = $('map');
  const listEl = $('list');
  const promptEl = $('prompt');
  const toastEl = $('toast');
  const timerFill = $('timerfill');
  const timerText = $('timertext');

  const regionsById = {};
  DATA.regions.forEach((r) => { regionsById[r.id] = r; });
  const pathEls = {};
  const labelEls = {};
  const hitEls = {};
  const listBtns = {};
  let ringEl = null;

  // ---------- Construcción del mapa ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildMap() {
    svg.setAttribute('viewBox', `0 0 ${DATA.width} ${DATA.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const b = DATA.canaryBox;
    el('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 8, class: 'canary-box' }, svg);

    // Silueta de España: trazo grueso debajo y relleno encima -> solo queda el contorno exterior.
    const gStroke = el('g', { class: 'outline-stroke' }, svg);
    const gFill = el('g', { class: 'outline-fill' }, svg);
    const gRegions = el('g', { class: 'regions' }, svg);
    const gHits = el('g', { class: 'hits' }, svg);
    const gLabels = el('g', { class: 'labels' }, svg);
    ringEl = el('circle', { class: 'ring', r: 18, cx: -100, cy: -100, visibility: 'hidden' }, svg);

    DATA.regions.forEach((r) => {
      el('path', { d: r.d }, gStroke);
      el('path', { d: r.d }, gFill);
      const p = el('path', { d: r.d, class: 'region', 'data-id': r.id }, gRegions);
      p.addEventListener('pointerdown', onMapPick);
      pathEls[r.id] = p;

      // Zona táctil ampliada para territorios muy pequeños.
      if (r.area < 200) {
        const h = el('circle', { cx: r.cx, cy: r.cy, r: 22, class: 'hit', 'data-id': r.id }, gHits);
        h.addEventListener('pointerdown', onMapPick);
        hitEls[r.id] = h;
      }

      const L = LABELS[r.id] || { t: [r.name] };
      const size = L.s || 16;
      const x = L.x != null ? L.x : r.cx;
      const y = L.y != null ? L.y : r.cy;
      const text = el('text', { x, y, class: 'label', 'font-size': size }, gLabels);
      const n = L.t.length;
      L.t.forEach((line, i) => {
        const ts = el('tspan', { x, dy: i === 0 ? `${(-(n - 1) / 2 + 0.35).toFixed(2)}em` : '1.1em' }, text);
        ts.textContent = line;
      });
      labelEls[r.id] = text;
    });
  }

  function buildList() {
    listEl.innerHTML = '';
    const items = state.ids.map((id) => regionsById[id]).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    items.forEach((r) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = r.id;
      btn.innerHTML = `<span class="sw"></span><span>${r.name}</span>`;
      btn.addEventListener('click', onListPick);
      li.appendChild(btn);
      listEl.appendChild(li);
      listBtns[r.id] = btn;
    });
  }

  // ---------- Sonido ----------
  let audioCtx = null;
  function beep(freqs, dur) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      let t = audioCtx.currentTime;
      freqs.forEach((f) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
        t += dur * 0.8;
      });
    } catch (e) { /* sin sonido */ }
  }
  const sndOk = () => beep([660, 880], 0.14);
  const sndKo = () => beep([300, 200], 0.2);
  const sndWin = () => beep([523, 659, 784, 1047], 0.16);

  // ---------- Utilidades ----------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let toastTimeout = 0;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = `toast show ${kind}`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toastEl.className = 'toast'; }, 1600);
  }

  function showRing(id, cls) {
    const r = regionsById[id];
    if (!r || r.area >= 200) { ringEl.setAttribute('visibility', 'hidden'); return; }
    ringEl.setAttribute('cx', r.cx);
    ringEl.setAttribute('cy', r.cy);
    ringEl.setAttribute('class', `ring ${cls || ''}`);
    ringEl.setAttribute('visibility', 'visible');
  }
  const hideRing = () => ringEl.setAttribute('visibility', 'hidden');

  function updateStats() {
    $('hits').textContent = state.hits;
    $('misses').textContent = state.misses;
    $('found').textContent = state.found.size;
    $('total').textContent = state.ids.length;
  }

  // ---------- Temporizador ----------
  function startTimer(seconds) {
    stopTimer();
    timerFill.className = '';
    if (!seconds) {
      timerFill.style.transform = 'scaleX(1)';
      timerText.textContent = '∞';
      return;
    }
    timer.duration = seconds * 1000;
    timer.start = performance.now();
    timer.elapsedBeforePause = 0;
    timer.paused = false;
    const tick = (now) => {
      const elapsed = timer.elapsedBeforePause + (now - timer.start);
      const left = Math.max(0, timer.duration - elapsed);
      const frac = left / timer.duration;
      timerFill.style.transform = `scaleX(${frac})`;
      timerFill.className = frac < 0.25 ? 'danger' : frac < 0.5 ? 'warn' : '';
      timerText.textContent = `${Math.ceil(left / 1000)} s`;
      if (left <= 0) { timer.raf = 0; onTimeout(); return; }
      timer.raf = requestAnimationFrame(tick);
    };
    timer.tick = tick;
    timer.raf = requestAnimationFrame(tick);
  }
  function stopTimer() {
    if (timer.raf) cancelAnimationFrame(timer.raf);
    timer.raf = 0;
  }
  function pauseTimer() {
    if (!timer.raf) return;
    stopTimer();
    timer.elapsedBeforePause += performance.now() - timer.start;
    timer.paused = true;
  }
  function resumeTimer() {
    if (!timer.paused) return;
    timer.paused = false;
    timer.start = performance.now();
    timer.raf = requestAnimationFrame(timer.tick);
  }

  // ---------- Partida ----------
  function newGame() {
    clearTimeout(nextTimeout);
    stopTimer();
    const ids = DATA.regions.map((r) => r.id).filter((id) => settings.cities || !CITIES.includes(id));
    state = {
      ids,
      queue: shuffle(ids.slice()),
      found: new Set(),
      failed: new Set(),
      hits: 0,
      misses: 0,
      current: null,
      q: null,
      locked: true
    };
    // Reiniciar el mapa
    DATA.regions.forEach((r) => {
      const p = pathEls[r.id];
      p.setAttribute('class', 'region');
      p.style.fill = '';
      p.style.display = ids.includes(r.id) ? '' : 'none';
      if (hitEls[r.id]) hitEls[r.id].style.display = ids.includes(r.id) ? '' : 'none';
      labelEls[r.id].classList.remove('visible');
    });
    hideRing();
    buildList();
    updateStats();
    nextQuestion();
  }

  function nextQuestion() {
    clearMarks();
    if (state.queue.length === 0) { endGame(); return; }
    state.current = state.queue.shift();
    state.q = settings.mode === 'mix' ? (Math.random() < 0.5 ? 'which' : 'where') : settings.mode;
    const id = state.current;

    if (state.q === 'which') {
      svg.classList.remove('show-borders');
      listEl.classList.add('pickable');
      pathEls[id].classList.add('highlight');
      showRing(id);
      promptEl.innerHTML = PROMPT_TEXT.which;
    } else {
      svg.classList.add('show-borders');
      listEl.classList.remove('pickable');
      listBtns[id].classList.add('target');
      listBtns[id].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      promptEl.innerHTML = PROMPT_TEXT.where(regionsById[id].name);
    }
    state.locked = false;
    startTimer(settings.time);
  }

  function clearMarks() {
    Object.values(pathEls).forEach((p) => p.classList.remove('highlight', 'right', 'wrong', 'reveal'));
    Object.values(listBtns).forEach((b) => b.classList.remove('target', 'right', 'wrong'));
    hideRing();
    // Las etiquetas mostradas solo como pista se ocultan si la comunidad no está descubierta.
    Object.keys(labelEls).forEach((id) => {
      if (!state.found.has(id)) labelEls[id].classList.remove('visible');
    });
  }

  function markFound(id) {
    state.found.add(id);
    const p = pathEls[id];
    p.classList.add('found');
    p.style.fill = COLORS[id];
    labelEls[id].classList.add('visible');
    const btn = listBtns[id];
    btn.classList.add('done');
    btn.querySelector('.sw').style.background = COLORS[id];
    btn.querySelector('.sw').style.borderColor = COLORS[id];
  }

  function resolve(correct, pickedId, reason) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    const id = state.current;
    const name = regionsById[id].name;

    if (correct) {
      state.hits++;
      markFound(id);
      pathEls[id].classList.add('right');
      listBtns[id].classList.add('right');
      showRing(id, 'right');
      sndOk();
      toast(`¡Muy bien! ${name} ✔`, 'ok');
    } else {
      state.misses++;
      state.failed.add(id);
      sndKo();
      if (pickedId && pickedId !== id) {
        if (state.q === 'which') listBtns[pickedId].classList.add('wrong');
        else pathEls[pickedId].classList.add('wrong');
      }
      // Mostrar la respuesta correcta un momento
      pathEls[id].classList.remove('highlight');
      pathEls[id].classList.add('reveal');
      listBtns[id].classList.remove('target');
      listBtns[id].classList.add('right');
      labelEls[id].classList.add('visible');
      showRing(id, 'reveal');
      toast(reason === 'time' ? `⏰ ¡Tiempo! Era ${name}` : `¡Uy! Era ${name}`, 'ko');
      // Volverá a salir más adelante
      const pos = Math.min(state.queue.length, 2 + Math.floor(Math.random() * 3));
      state.queue.splice(pos, 0, id);
    }
    updateStats();
    nextTimeout = setTimeout(nextQuestion, correct ? 1000 : 2000);
  }

  function onListPick(e) {
    if (!state || state.locked || state.q !== 'which') return;
    const id = e.currentTarget.dataset.id;
    if (state.found.has(id)) return;
    resolve(id === state.current, id);
  }

  function onMapPick(e) {
    if (!state || state.locked || state.q !== 'where') return;
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    if (state.found.has(id)) return;
    resolve(id === state.current, id);
  }

  function onTimeout() {
    resolve(false, null, 'time');
  }

  function endGame() {
    stopTimer();
    svg.classList.remove('show-borders');
    listEl.classList.remove('pickable');
    promptEl.textContent = '¡Mapa completado! 🎉';
    timerText.textContent = '';
    sndWin();
    const total = state.ids.length;
    const firstTry = total - state.failed.size;
    const stars = state.misses === 0 ? 3 : state.misses <= 3 ? 2 : 1;
    $('stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('endTitle').textContent = stars === 3 ? '¡Perfecto! 🏆' : stars === 2 ? '¡Muy bien! 🎉' : '¡Completado! 💪';
    let txt = `Has acertado <b>${firstTry}</b> de <b>${total}</b> a la primera.<br>Fallos: <b>${state.misses}</b>.`;
    if (state.failed.size) {
      const names = [...state.failed].map((id) => regionsById[id].name).sort((a, b) => a.localeCompare(b, 'es'));
      txt += `<br><br>Para repasar: <b>${names.join(', ')}</b>`;
    }
    $('endText').innerHTML = txt;
    setTimeout(() => $('end').classList.add('show'), 700);
  }

  // ---------- Menú ----------
  function setupOptions(groupId, key, parse) {
    const group = $(groupId);
    group.querySelectorAll('.opt').forEach((b) => {
      b.addEventListener('click', () => {
        group.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        settings[key] = parse(b.dataset.v);
        savePrefs();
      });
    });
  }
  function selectOption(groupId, value) {
    $(groupId).querySelectorAll('.opt').forEach((b) => b.classList.toggle('sel', b.dataset.v === String(value)));
  }

  function savePrefs() {
    try { localStorage.setItem('geomaster-prefs', JSON.stringify(settings)); } catch (e) { /* ignorar */ }
  }
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('geomaster-prefs') || 'null');
      if (p) Object.assign(settings, p);
    } catch (e) { /* ignorar */ }
  }

  function openMenu() {
    if (state && !state.locked) pauseTimer();
    $('end').classList.remove('show');
    $('menu').classList.add('show');
  }

  function init() {
    loadPrefs();
    buildMap();
    setupOptions('optMode', 'mode', (v) => v);
    setupOptions('optTime', 'time', (v) => Number(v));
    selectOption('optMode', settings.mode);
    selectOption('optTime', settings.time);
    $('optCities').checked = settings.cities;
    $('optCities').addEventListener('change', (e) => { settings.cities = e.target.checked; savePrefs(); });
    $('btnSound').textContent = settings.sound ? '🔊' : '🔇';

    $('btnStart').addEventListener('click', () => {
      $('menu').classList.remove('show');
      newGame();
    });
    $('btnAgain').addEventListener('click', () => { $('end').classList.remove('show'); newGame(); });
    $('btnToMenu').addEventListener('click', openMenu);
    $('btnMenu').addEventListener('click', openMenu);
    $('btnSound').addEventListener('click', () => {
      settings.sound = !settings.sound;
      $('btnSound').textContent = settings.sound ? '🔊' : '🔇';
      savePrefs();
    });
    // Cerrar el menú tocando fuera reanuda la partida en curso
    $('menu').addEventListener('click', (e) => {
      if (e.target === $('menu') && state) { $('menu').classList.remove('show'); resumeTimer(); }
    });

    // Lista vacía de fondo mientras está el menú
    state = { ids: DATA.regions.map((r) => r.id), found: new Set(), hits: 0, misses: 0, locked: true };
    buildList();
    updateStats();
    state = null;
  }

  init();
})();
