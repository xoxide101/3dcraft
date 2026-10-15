/* 3DCraft timeline (animation), in the style of motion-graphics timelines: a row per layer with its timer bar (when it
   shows), twirl a layer open for Position, Turn, Size, Colour and Opacity, each with a stopwatch and keyframe diamonds.
   Play, rewind, step, loop, scrub; ready-made moves; a camera turntable or swing. */
(function () {
  'use strict';
  const E = window.E3, $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const TL = (window.TL3 = {});
  const open = new Set(); // twirled-open layers
  let playing = false, last = 0, selKey = null, zoomPx = 0;
  const host = $('timeline');
  const fmt = (t, fps) => { const s = Math.floor(t), f = Math.round((t - s) * fps); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.min(f, fps - 1)).padStart(2, '0')}`; };
  const changed = () => window.UI3 && window.UI3.changed();
  const STOPWATCH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/></svg>';

  host.innerHTML = `<div class="tl-bar">
      <button class="btn tl-ic" data-tl="start" title="Back to the start (Home)">⏮</button><button class="btn tl-ic" data-tl="prev" title="One frame back (,)">◀|</button>
      <button class="btn tl-ic tl-play" data-tl="play" title="Play / pause (Space)">▶</button><button class="btn tl-ic" data-tl="next" title="One frame on (.)">|▶</button><button class="btn tl-ic" data-tl="end" title="To the end (End)">⏭</button>
      <button class="btn tl-ic" data-tl="loop" title="Loop">⟲</button>
      <span class="tl-time" id="tl-time">00:00.00</span>
      <label class="tl-f">Length <input class="input" type="number" id="tl-len" min="0.5" max="120" step="0.5"> s</label>
      <label class="tl-f">Frames/s <select class="input" id="tl-fps"><option>12</option><option>15</option><option>24</option><option>25</option><option>30</option><option>60</option></select></label>
      <label class="tl-f">Move <select class="input" id="tl-preset"><option value="">Add a move to the selected…</option></select></label>
      <label class="tl-f">Camera <select class="input" id="tl-cam"><option value="none">Still</option><option value="turntable">Turntable (all the way round)</option><option value="swing">Swing (to and fro)</option></select></label>
      <label class="tl-f" id="tl-amt-f">° <input class="input" type="number" id="tl-amt" min="5" max="1080" step="5"></label>
      <span style="flex:1"></span>
      <button class="btn tl-ic" data-tl="zoomout" title="Shorter time ruler">−</button><button class="btn tl-ic" data-tl="zoomin" title="Longer time ruler">+</button>
      <button class="btn" data-tl="export" title="Save the animation as GIF, MP4, WebM, AVI or PNG frames">Export animation…</button>
    </div>
    <div class="tl-body" id="tl-body"><div class="tl-rows" id="tl-rows"></div></div>`;
  const PRESETS = {
    spin: ['Spin (turn all the way round)', (m, a) => ({ rot: [[0, m.rot], [a.length, [m.rot[0], m.rot[1] + 360, m.rot[2]], 'linear']] })],
    spinx: ['Flip (turn over forwards)', (m, a) => ({ rot: [[0, m.rot], [a.length, [m.rot[0] + 360, m.rot[1], m.rot[2]], 'linear']] })],
    bounce: ['Bounce', (m, a) => { const p = m.pos, up = [p[0], p[1] + 1.5, p[2]], q = a.length / 4; return { pos: [[0, p, 'out'], [q, up, 'in'], [2 * q, p, 'out'], [3 * q, up, 'in'], [4 * q, p]] }; }],
    flyin: ['Fly in from the left', (m) => ({ pos: [[0, [m.pos[0] - 10, m.pos[1], m.pos[2]], 'out'], [1.2, m.pos]] })],
    flyup: ['Rise up from below', (m) => ({ pos: [[0, [m.pos[0], m.pos[1] - 4, m.pos[2]], 'out'], [1.2, m.pos]] })],
    fadein: ['Fade in', () => ({ opacity: [[0, 0, 'ease'], [0.8, 1]] })],
    fadeout: ['Fade out at the end', (m, a) => ({ opacity: [[Math.max(0, a.length - 0.8), 1, 'ease'], [a.length, 0]] })],
    grow: ['Grow in (with a bounce)', (m) => ({ scale: [[0, m.scale.map((v) => v * 0.01), 'bounce'], [1, m.scale]] })],
    pulse: ['Pulse', (m, a) => ({ scale: [[0, m.scale, 'ease'], [a.length / 2, m.scale.map((v) => v * 1.15), 'ease'], [a.length, m.scale]] })],
    float: ['Float up and down', (m, a) => { const p = m.pos; return { pos: [[0, p, 'ease'], [a.length / 2, [p[0], p[1] + 0.4, p[2]], 'ease'], [a.length, p]] }; }],
    wobble: ['Wobble', (m, a) => { const r = m.rot, q = a.length / 4; return { rot: [[0, r, 'ease'], [q, [r[0], r[1], r[2] + 10], 'ease'], [2 * q, r, 'ease'], [3 * q, [r[0], r[1], r[2] - 10], 'ease'], [4 * q, r]] }; }],
    rainbow: ['Colour cycle', (m, a) => ({ color: [[0, '#e03131', 'linear'], [a.length / 3, '#2f9e44', 'linear'], [(2 * a.length) / 3, '#1c7ed6', 'linear'], [a.length, '#e03131']] })],
    clear: ['Remove all moves', () => null],
  };
  $('tl-preset').innerHTML += Object.entries(PRESETS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('');

  // ---- drawing
  const ROW = 26;
  const pxPerSec = () => { const a = E.anim(), w = Math.max(200, ($('tl-body').clientWidth || 600) - X0 - 20); return zoomPx || w / a.length; };
  const X0 = 262; // where time zero is (the labels are 250 wide)
  const xOf = (t) => X0 + t * pxPerSec();
  function rowsFor() {
    const out = [];
    const walk = (pid, depth) => E.children(pid).slice().reverse().forEach((m) => { out.push({ m, depth }); if (open.has(m.id)) Object.keys(E.ANIM_PROPS).forEach((p) => { if ((p === 'color' || p === 'opacity') && m.kind === 'group') return; out.push({ m, prop: p, depth }); }); if (m.kind === 'group') walk(m.id, depth + 1); });
    walk(null, 0);
    return out;
  }
  TL.render = function () {
    if (!E.doc) { $('tl-rows').innerHTML = ''; return; }
    const a = E.anim(), pps = pxPerSec(), W = X0 + a.length * pps + 20;
    $('tl-len').value = a.length; $('tl-fps').value = String(a.fps); $('tl-cam').value = (a.camera && a.camera.move) || 'none'; $('tl-amt').value = (a.camera && a.camera.amount) ?? 360; $('tl-amt-f').hidden = $('tl-cam').value === 'none';
    host.querySelector('[data-tl="loop"]').setAttribute('aria-pressed', String(!!a.loop));
    // the ruler: seconds with marks for every frame group
    const step = pps > 120 ? 0.25 : pps > 50 ? 0.5 : pps > 20 ? 1 : 5;
    let ruler = `<div class="tl-ruler" style="width:${W}px"><div class="tl-rlab">Time</div>`;
    for (let t = 0; t <= a.length + 1e-6; t += step) { const whole = Math.abs(t - Math.round(t)) < 1e-6; ruler += `<i style="left:${xOf(t)}px" class="${whole ? 'tl-whole' : ''}"></i>` + (whole ? `<span class="tl-sec" style="left:${xOf(t) + 3}px">${Math.round(t)} s</span>` : ''); }
    ruler += `<div class="tl-end" style="left:${xOf(a.length)}px"></div></div>`;
    let html = ruler;
    rowsFor().forEach(({ m, prop, depth }) => {
      const tr = a.tracks[m.id] || { keys: {} };
      if (!prop) {
        const st = tr.start ?? 0, en = tr.end ?? a.length, anyKeys = Object.values(tr.keys || {}).flat();
        html += `<div class="tl-row layer${E.selectedId() === m.id ? ' on' : ''}" data-id="${m.id}" style="width:${W}px"><div class="tl-lab" style="padding-left:${6 + depth * 12}px"><button class="tl-tw" data-tw="${m.id}" aria-expanded="${open.has(m.id)}" title="Show its properties">${open.has(m.id) ? '▾' : '▸'}</button><span class="tl-name" data-sel="${m.id}">${esc(m.name || m.kind)}</span></div>`
          + `<div class="tl-timer" data-timer="${m.id}" style="left:${xOf(st)}px;width:${Math.max(4, (en - st) * pps)}px" title="Shows from ${st.toFixed(2)} s to ${en.toFixed(2)} s: drag the ends to change"><b class="tl-h l"></b><b class="tl-h r"></b></div>`
          + anyKeys.map((k) => `<i class="tl-dot" style="left:${xOf(k.t)}px"></i>`).join('') + '</div>';
      } else {
        const keys = (tr.keys || {})[prop] || [], on = keys.length > 0, here = keys.some((k) => Math.abs(k.t - E.time) < 0.5 / a.fps);
        html += `<div class="tl-row prop" data-id="${m.id}" data-prop="${prop}" style="width:${W}px"><div class="tl-lab" style="padding-left:${26 + depth * 12}px"><button class="tl-sw${on ? ' on' : ''}" data-sw="${prop}" title="${on ? 'Stop animating (keeps the value here)' : 'Animate this: changes become keyframes'}">${STOPWATCH}</button><span>${E.ANIM_PROPS[prop]}</span><button class="tl-k${here ? ' on' : ''}" data-addkey="${prop}" title="${here ? 'Remove the keyframe here' : 'Add a keyframe here'}">◆</button></div>`
          + keys.map((k, i) => `<i class="tl-key${selKey && selKey.k === k ? ' sel' : ''} e-${k.ease || 'ease'}" data-key="${i}" style="left:${xOf(k.t)}px" title="${k.t.toFixed(2)} s · ${E.EASES[k.ease || 'ease']} (double-click to change)"></i>`).join('') + '</div>';
      }
    });
    if (!E.doc.objects.length) html += '<p class="hint" style="padding:8px 12px">Add something to the scene, then pick a move above, or twirl a layer open (▸) and click a stopwatch.</p>';
    html += `<div class="tl-head" id="tl-head" style="left:${xOf(E.time)}px"><b></b></div>`;
    $('tl-rows').innerHTML = html; $('tl-rows').style.width = W + 'px';
    TL.updateHead();
  };
  TL.updateHead = function () {
    const a = E.anim(); if (!a) return;
    const h = $('tl-head'); if (h) h.style.left = xOf(E.time) + 'px';
    $('tl-time').textContent = fmt(E.time, a.fps);
    host.querySelector('[data-tl="play"]').textContent = playing ? '❚❚' : '▶';
  };
  // ---- time
  const frame = () => 1 / (E.anim().fps || 30);
  const snap = (t) => Math.round(t / frame()) * frame();
  TL.seek = (t) => { E.evalAt(snap(Math.max(0, Math.min(E.anim().length, t)))); TL.updateHead(); if (!playing) TL.render(); };
  TL.play = () => { if (!E.doc) return; if (playing) { playing = false; TL.render(); return; } const a = E.anim(); if (E.time >= a.length - 1e-3) E.evalAt(0); playing = true; last = performance.now(); requestAnimationFrame(tick); TL.updateHead(); };
  TL.playing = () => playing;
  function tick(now) {
    if (!playing || !E.doc) return;
    const a = E.anim(); let t = E.time + (now - last) / 1000; last = now;
    if (t > a.length) { if (a.loop) t %= a.length; else { t = a.length; playing = false; } }
    E.evalAt(t); TL.updateHead();
    if (playing) requestAnimationFrame(tick); else TL.render();
  }
  // ---- controls
  host.querySelector('.tl-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tl]'); if (!b || !E.doc) return;
    const a = E.anim(), k = b.dataset.tl;
    if (k === 'play') TL.play();
    else if (k === 'start') { playing = false; TL.seek(0); }
    else if (k === 'end') { playing = false; TL.seek(a.length); }
    else if (k === 'prev') TL.seek(E.time - frame());
    else if (k === 'next') TL.seek(E.time + frame());
    else if (k === 'loop') { a.loop = !a.loop; changed(); TL.render(); }
    else if (k === 'zoomin') { zoomPx = pxPerSec() * 1.4; TL.render(); }
    else if (k === 'zoomout') { zoomPx = Math.max(10, pxPerSec() / 1.4); TL.render(); }
    else if (k === 'export') window.ANIM3 && window.ANIM3.open();
  });
  $('tl-len').onchange = () => { const a = E.anim(), v = Math.max(0.5, Math.min(120, +$('tl-len').value || a.length)), k = v / a.length; Object.values(a.tracks).forEach((tr) => { Object.values(tr.keys).forEach((ks) => ks.forEach((x) => { x.t = +(x.t * k).toFixed(4); })); if (tr.start != null) tr.start *= k; if (tr.end != null) tr.end *= k; }); a.length = v; zoomPx = 0; E.evalAt(Math.min(E.time * k, v)); changed(); TL.render(); };
  $('tl-fps').onchange = () => { E.anim().fps = +$('tl-fps').value; changed(); TL.render(); };
  $('tl-cam').onchange = () => { const a = E.anim(); a.camera = { ...(a.camera || {}), move: $('tl-cam').value, amount: $('tl-cam').value === 'swing' ? 60 : 360 }; E.evalAt(E.time); changed(); TL.render(); };
  $('tl-amt').onchange = () => { const a = E.anim(); a.camera.amount = +$('tl-amt').value || 360; E.evalAt(E.time); changed(); };
  $('tl-preset').onchange = () => { const k = $('tl-preset').value; $('tl-preset').value = ''; if (k) TL.preset(k); };
  TL.camera = (mode) => { if (!E.doc) return; $('tl-cam').value = mode; $('tl-cam').onchange(); if (mode !== 'none' && !playing) TL.play(); };
  TL.preset = (k) => {
    if (!E.doc) return;
    const m = E.selectedId() && E.find(E.selectedId()); if (!m) { window.UI3 && window.UI3.toast && window.UI3.toast('Click an object first, then pick a move.'); return; }
    const a = E.anim(), made = PRESETS[k][1](m, a);
    if (!made) { delete a.tracks[m.id]; } else { const tr = E.track(m.id, true); Object.entries(made).forEach(([prop, list]) => { tr.keys[prop] = list.map(([t, v, ease]) => ({ t: +t.toFixed(4), v: JSON.parse(JSON.stringify(v)), ease: ease || 'ease' })); }); open.add(m.id); }
    E.evalAt(E.time); changed(); TL.render(); if (k !== 'clear' && !playing) TL.play();
  };
  // ---- rows: twirl, select, stopwatches, keys, timers
  const rows = $('tl-rows');
  rows.addEventListener('click', (e) => {
    const tw = e.target.closest('[data-tw]'); if (tw) { open.has(tw.dataset.tw) ? open.delete(tw.dataset.tw) : open.add(tw.dataset.tw); TL.render(); return; }
    const sl = e.target.closest('[data-sel]'); if (sl) { E.select(sl.dataset.sel); return; }
    const row = e.target.closest('.tl-row'); if (!row) return;
    const m = E.find(row.dataset.id); if (!m) return;
    const sw = e.target.closest('[data-sw]');
    if (sw) { const p = sw.dataset.sw, tr = E.track(m.id, true); if (tr.keys[p] && tr.keys[p].length) { const cur = E.valueAt(m, p, E.time); delete tr.keys[p]; E.setValue(m, p, cur); } else E.setKey(m, p, E.time, JSON.parse(JSON.stringify(E.valueAt(m, p, E.time)))); E.evalAt(E.time); changed(); TL.render(); return; }
    const ak = e.target.closest('[data-addkey]');
    if (ak) { const p = ak.dataset.addkey, tr = E.track(m.id, true), keys = tr.keys[p] || [], here = keys.find((k) => Math.abs(k.t - E.time) < 0.5 / E.anim().fps); if (here) E.removeKey(m, p, here); else E.setKey(m, p, E.time, JSON.parse(JSON.stringify(E.valueAt(m, p, E.time)))); E.evalAt(E.time); changed(); TL.render(); return; }
  });
  // scrubbing on the ruler (or empty track space), dragging keys and timer bars
  rows.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = rows.getBoundingClientRect(), tAt = (cx) => (cx - r.left - X0) / pxPerSec();
    const key = e.target.closest('.tl-key'), timer = e.target.closest('.tl-timer');
    if (key) {
      const row = key.closest('.tl-row'), m = E.find(row.dataset.id), prop = row.dataset.prop, k = E.track(m.id).keys[prop][+key.dataset.key];
      selKey = { m, prop, k }; rows.setPointerCapture(e.pointerId);
      const move = (ev) => { k.t = +Math.max(0, Math.min(E.anim().length, snap(tAt(ev.clientX)))).toFixed(4); key.style.left = xOf(k.t) + 'px'; };
      const up = () => { rows.removeEventListener('pointermove', move); rows.removeEventListener('pointerup', up); E.track(m.id).keys[prop].sort((a, b) => a.t - b.t); E.evalAt(E.time); changed(); TL.render(); };
      rows.addEventListener('pointermove', move); rows.addEventListener('pointerup', up); TL.render(); return;
    }
    if (timer) {
      const m = E.find(timer.dataset.timer), tr = E.track(m.id, true), a = E.anim(), side = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
      const st0 = tr.start ?? 0, en0 = tr.end ?? a.length, t0 = tAt(e.clientX); rows.setPointerCapture(e.pointerId);
      const move = (ev) => { const d = snap(tAt(ev.clientX) - t0); if (side === 'l') tr.start = Math.max(0, Math.min(en0 - frame(), st0 + d)); else if (side === 'r') tr.end = Math.min(a.length, Math.max(st0 + frame(), en0 + d)); else { const len = en0 - st0, s = Math.max(0, Math.min(a.length - len, st0 + d)); tr.start = s; tr.end = s + len; }
        const st = tr.start ?? 0, en = tr.end ?? a.length; timer.style.left = xOf(st) + 'px'; timer.style.width = Math.max(4, (en - st) * pxPerSec()) + 'px'; };
      const up = () => { rows.removeEventListener('pointermove', move); rows.removeEventListener('pointerup', up); if ((tr.start ?? 0) <= 0) delete tr.start; if ((tr.end ?? a.length) >= a.length) delete tr.end; E.evalAt(E.time); changed(); TL.render(); };
      rows.addEventListener('pointermove', move); rows.addEventListener('pointerup', up); return;
    }
    if (e.clientX - r.left < 250 || e.target.closest('button')) return;
    playing = false; rows.setPointerCapture(e.pointerId); TL.seek(tAt(e.clientX));
    const move = (ev) => TL.seek(tAt(ev.clientX)), up = () => { rows.removeEventListener('pointermove', move); rows.removeEventListener('pointerup', up); TL.render(); };
    rows.addEventListener('pointermove', move); rows.addEventListener('pointerup', up);
  });
  // double-click a key: how it moves on to the next key
  rows.addEventListener('dblclick', (e) => {
    const key = e.target.closest('.tl-key'); if (!key) return;
    const row = key.closest('.tl-row'), m = E.find(row.dataset.id), prop = row.dataset.prop, k = E.track(m.id).keys[prop][+key.dataset.key];
    const pop = document.createElement('div'); pop.className = 'tl-pop';
    pop.innerHTML = `<b>From this key to the next</b>${Object.entries(E.EASES).map(([v, n]) => `<button type="button" data-ease="${v}" aria-pressed="${(k.ease || 'ease') === v}">${n}</button>`).join('')}<button type="button" data-ease="del" class="danger">Delete this key</button>`;
    const kr = key.getBoundingClientRect(); pop.style.left = Math.min(innerWidth - 220, kr.left) + 'px'; pop.style.top = Math.max(8, kr.top - 250) + 'px';
    document.body.append(pop);
    const close = () => { pop.remove(); document.removeEventListener('pointerdown', out, true); };
    const out = (ev) => { if (!pop.contains(ev.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    pop.onclick = (ev) => { const b = ev.target.closest('[data-ease]'); if (!b) return; if (b.dataset.ease === 'del') E.removeKey(m, prop, k); else k.ease = b.dataset.ease; close(); E.evalAt(E.time); changed(); TL.render(); };
  });
  // Delete removes the selected key (the app's own Delete is used when no key is selected)
  TL.deleteSelectedKey = () => { if (!selKey) return false; E.removeKey(selKey.m, selKey.prop, selKey.k); selKey = null; E.evalAt(E.time); changed(); TL.render(); return true; };
  TL.hasSelectedKey = () => !!selKey;
  document.addEventListener('pointerdown', (e) => { if (selKey && !e.target.closest('.tl-key') && !e.target.closest('.tl-pop')) { selKey = null; if (!playing) TL.render(); } });
  E.on('select', () => { if (!playing) TL.render(); });
  E.on('built', () => { if (!playing) TL.render(); });
  new ResizeObserver(() => { if (!playing) TL.render(); }).observe(host);
})();
