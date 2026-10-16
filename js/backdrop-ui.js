/* 3DCraft Backdrop tab (left panel): the sky, the style (Classic or Modern), palettes, movement, and the stack of
   layers from back to front with each layer's settings. Works on doc.backdrop through window.BD3. */
(function () {
  'use strict';
  const E = window.E3, BD = window.BD3, $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const host = $('backdrop-panel');
  let cur = null; // the layer being edited
  const EYE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.2 6.2C3.6 8 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.3-1"/></svg>';

  // a change to the backdrop: keep it (undo, autosave), rebuild it, show the panel again
  function changed(redraw = true) { if (window.UI3) UI3.changed(); BD.sync(); if (redraw) render(); }
  const bd = () => BD.get();
  const seg = (items, val, attr) => `<div class="seg" role="group">${items.map(([v, n]) => `<button class="btn" type="button" ${attr}="${v}" aria-pressed="${String(v) === String(val)}">${n}</button>`).join('')}</div>`;
  const opts = (obj, val) => Object.entries(obj).map(([v, n]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${esc(Array.isArray(n) ? n[0] : n)}</option>`).join('');
  const range = (id, label, val, min, max, step, show) => `<label class="field"><span>${label}: <b id="${id}-v">${show ? show(val) : val}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;

  function render() {
    if (!host) return;
    if (!E.doc) { host.innerHTML = ''; return; }
    const b = bd();
    let html = `<div class="pad bd">
      <h3>Choose a backdrop</h3>
      <div class="bd-themes">${Object.entries(BD.THEMES).map(([k, [n]]) => `<button class="btn" type="button" data-theme="${k}" aria-pressed="${!!(b && b.theme === k)}" title="${esc(n)}: click again for another one">${esc(n)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" type="button" data-bd="new" title="A random kind of backdrop">🎲 Surprise me</button><button class="btn outline" type="button" data-bd="shuffle" ${b && b.layers.length ? '' : 'disabled'} title="Keep the layers, give them new shapes">🎲 Shuffle shapes</button></div>`;
    if (!b) {
      html += `<p class="hint">A backdrop is scenery behind your scene in layers, like the flats of a stage or the layers of an old video game: sun or moon, stars, clouds, mountains, hills, trees, a city or the sea. Farther layers are hazier, and each can scroll at its own speed for depth.</p><h3>Sky</h3><div id="bd-sky"></div></div>`;
      host.innerHTML = html; mountSky(); return;
    }
    const L = cur && b.layers.find((x) => x.id === cur);
    html += `<label class="check"><input type="checkbox" id="bd-on" ${b.on ? 'checked' : ''}> Show the backdrop</label>
      <h3>Style</h3>${seg([['classic', 'Classic (flat)'], ['modern', 'Modern (3D)'], ['cardboard', 'Cardboard']], b.style, 'data-style')}
      ${(b.style === 'cardboard' || b.layers.some((l) => l.style === 'cardboard')) ? `<label class="check"><input type="checkbox" id="bd-stands" ${b.stands !== false ? 'checked' : ''}> Show the fold-out stands and cloud sticks</label>` : ''}
      <h3>Palette</h3>${seg(Object.entries(BD.PALETTES).map(([k, [n]]) => [k, n]), b.palette, 'data-pal')}
      ${range('bd-y', 'Raise or lower it all (to the horizon)', b.y || 0, -40, 40, 0.5)}
      <h3>Ground</h3>
      <label class="check"><input type="checkbox" id="bd-gon" ${b.groundOn !== false ? 'checked' : ''}> Matching ground (instead of the plain floor)</label>
      ${b.groundOn !== false ? `<label class="field"><span>Ground</span><select class="input" id="bd-gkind">${opts(BD.GROUNDS, b.groundKind || 'auto')}</select></label>
      <label class="check"><input type="checkbox" id="bd-blend" ${b.blend !== false ? 'checked' : ''}> Blend into the scenery</label>
      ${range('bd-beach', 'Beach or play area size', b.beach ?? 14, 4, 50, 1)}` : ''}
      <h3>Sky</h3><div id="bd-sky"></div>
      <h3>Movement</h3>
      ${range('bd-speed', 'Scroll speed', b.speed || 0, -20, 20, 0.5, (v) => (+v === 0 ? 'still' : (v > 0 ? 'to the left, ' : 'to the right, ') + Math.abs(v)))}
      ${seg([['loop', 'Endless loop'], ['once', 'Pass by once']], b.mode || 'loop', 'data-mode')}
      <p class="hint">Near layers move faster than far ones, for depth. Play the timeline to see it.</p>
      <h3>Layers <small class="hint">(back to front)</small></h3>
      <div class="layers bd-layers">${b.layers.map((l, i) => `<div class="layer${l.id === cur ? ' on' : ''}${l.visible === false ? ' off' : ''}" data-l="${l.id}">
        <button class="lb" type="button" data-la="vis" title="${l.visible === false ? 'Show' : 'Hide'}">${l.visible === false ? EYE_OFF : EYE}</button><span></span>
        <span class="ln" data-la="sel">${esc(BD.KINDS[l.kind][0])}<small class="hint"> · ${Math.round(BD.distOf(i, b.layers.length))} out${l.style ? ' · ' + ({ modern: 'Modern', classic: 'Classic', cardboard: 'Cardboard' })[l.style] : ''}</small></span>
        <button class="lb" type="button" data-la="back" title="Farther back">▲</button><button class="lb" type="button" data-la="front" title="Nearer the front">▼</button></div>`).join('') || '<p class="hint">No layers yet.</p>'}</div>
      <div class="row"><select class="input" id="bd-add"><option value="">Add a layer…</option>${opts(BD.KINDS)}</select><button class="btn outline" type="button" data-bd="del" ${L ? '' : 'disabled'}>Delete layer</button></div>`;
    if (L) {
      const E1 = L.enter || {}, X1 = L.exit || {};
      html += `<div class="bd-edit"><h3>${esc(BD.KINDS[L.kind][0])}</h3>
        <div class="row"><label class="field"><span>Kind</span><select class="input" id="bdl-kind">${opts(BD.KINDS, L.kind)}</select></label><label class="field"><span>Style</span><select class="input" id="bdl-style">${opts({ '': 'Same as the backdrop', classic: 'Classic (flat)', modern: 'Modern (3D)', cardboard: 'Cardboard' }, L.style || '')}</select></label></div>
        <button class="btn outline" type="button" data-bd="reseed" title="A new shape for this layer">🎲 New shape</button>
        ${L.kind === 'picture' ? `<button class="btn primary" type="button" data-bd="pic">${L.src ? 'Change the picture…' : 'Choose a picture…'}</button>
          ${range('bdl-size', 'Size', L.size ?? 1, 0.1, 4, 0.05, (v) => Math.round(v * 100) + '%')}
          <label class="field"><span>Repeat along the layer (0 = once)</span><input class="input" type="number" id="bdl-repeat" min="0" max="12" step="1" value="${L.repeat ?? 1}"></label>
          <label class="check"><input type="checkbox" id="bdl-rbg" ${L.removeBg !== false ? 'checked' : ''}> Remove a plain background</label>
          <label class="check"><input type="checkbox" id="bdl-border" ${L.border !== false ? 'checked' : ''}> White cut-out border</label>
          ${range('bdl-emboss', 'Emboss', L.emboss ?? 1, 0, 2, 0.05, (v) => Math.round(v * 100) + '%')}` : ''}
        ${L.kind === 'forest' ? `<label class="field"><span>Trees</span><select class="input" id="bdl-type">${opts(BD.FOREST_TYPES, L.type || 'oak')}</select></label>${range('bdl-density', 'How many trees', L.density ?? 1, 0.2, 3, 0.05, (v) => Math.round(v * 100) + '%')}` : ''}
        ${L.kind !== 'picture' ? range('bdl-height', 'Height', L.height ?? 1, 0.2, 3, 0.05, (v) => Math.round(v * 100) + '%') : ''}
        ${range('bdl-y', 'Raise or lower', L.y || 0, -30, 30, 0.5)}
        ${range('bdl-haze', 'Haze (distance)', L.haze ?? 1, 0, 2, 0.05, (v) => Math.round(v * 100) + '%')}
        <div class="row"><label class="check"><input type="checkbox" id="bdl-auto" ${L.color ? '' : 'checked'}> Palette colour</label><label class="field"><span>Own colour</span><input class="input" type="color" id="bdl-color" value="${L.color || '#7a8aa0'}" ${L.color ? '' : 'disabled'}></label></div>
        ${range('bdl-speed', 'Scroll speed (× its depth speed)', L.speed ?? 1, 0, 3, 0.05, (v) => (+v).toFixed(2) + '×')}
        ${range('bdl-bob', 'Bob up and down', L.bob || 0, 0, 2, 0.05)}
        <h3>Comes in</h3><div class="row"><select class="input" id="bdl-in">${opts(BD.MOVES_IN, E1.move || 'none')}</select><span></span></div>
        <div class="row"><label class="field"><span>At (s)</span><input class="input" type="number" id="bdl-in-at" min="0" step="0.1" value="${E1.at ?? 0}"></label><label class="field"><span>Taking (s)</span><input class="input" type="number" id="bdl-in-dur" min="0.1" step="0.1" value="${E1.dur ?? 1.5}"></label></div>
        <h3>Goes out</h3><div class="row"><select class="input" id="bdl-out">${opts(BD.MOVES_OUT, X1.move || 'none')}</select><span></span></div>
        <div class="row"><label class="field"><span>At (s)</span><input class="input" type="number" id="bdl-out-at" min="0" step="0.1" value="${X1.at ?? 3.5}"></label><label class="field"><span>Taking (s)</span><input class="input" type="number" id="bdl-out-dur" min="0.1" step="0.1" value="${X1.dur ?? 1.5}"></label></div>
      </div>`;
    } else html += '<p class="hint">Click a layer to change it: its shape, height, colour, speed, and how it comes in and goes out (like a stage flat).</p>';
    html += '</div>';
    host.innerHTML = html;
    mountSky(); bind(b, L);
  }
  function mountSky() {
    const el = $('bd-sky'); if (!el || !window.paintPicker) return;
    el.append(window.paintPicker(E.doc.scene.bg, (f) => { E.doc.scene.bg = f; E.applyScene(); if (window.UI3) UI3.changed(); render(); }, { none: 'See-through', unit: 'mm', label: 'Behind everything', base: '#dfe7f2' }));
  }
  function bind(b, L) {
    const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
    on('bd-on', 'onchange', (e) => { b.on = e.target.checked; changed(); });
    on('bd-stands', 'onchange', (e) => { b.stands = e.target.checked; changed(); });
    on('bd-gon', 'onchange', (e) => { b.groundOn = e.target.checked; changed(); });
    on('bd-gkind', 'onchange', (e) => { b.groundKind = e.target.value; changed(); });
    on('bd-blend', 'onchange', (e) => { b.blend = e.target.checked; changed(); });
    on('bd-beach', 'oninput', (e) => { $('bd-beach-v').textContent = e.target.value; }); on('bd-beach', 'onchange', (e) => { b.beach = +e.target.value; changed(); });
    on('bd-speed', 'oninput', (e) => { b.speed = +e.target.value; $('bd-speed-v').textContent = +e.target.value === 0 ? 'still' : (e.target.value > 0 ? 'to the left, ' : 'to the right, ') + Math.abs(e.target.value); BD.pose(E.time); });
    on('bd-speed', 'onchange', () => changed(false));
    on('bd-y', 'oninput', (e) => { b.y = +e.target.value; $('bd-y-v').textContent = e.target.value; BD.pose(E.time); }); on('bd-y', 'onchange', () => changed(false));
    on('bd-add', 'onchange', (e) => { const k = e.target.value; if (!k) return; const l = BD.newLayer(k); b.layers.push(l); cur = l.id; changed(); if (k === 'picture') choosePicture(l); });
    if (!L) return;
    const live = (id, key, fmt) => { on(id, 'oninput', (e) => { L[key] = +e.target.value; $(id + '-v').textContent = fmt ? fmt(+e.target.value) : e.target.value; }); on(id, 'onchange', () => changed()); };
    live('bdl-height', 'height', (v) => Math.round(v * 100) + '%');
    live('bdl-density', 'density', (v) => Math.round(v * 100) + '%'); on('bdl-type', 'onchange', (e) => { L.type = e.target.value; changed(); }); live('bdl-size', 'size', (v) => Math.round(v * 100) + '%'); live('bdl-emboss', 'emboss', (v) => Math.round(v * 100) + '%');
    on('bdl-repeat', 'onchange', (e) => { L.repeat = Math.max(0, Math.min(12, +e.target.value | 0)); changed(); });
    on('bdl-rbg', 'onchange', (e) => { L.removeBg = e.target.checked; changed(); });
    on('bdl-border', 'onchange', (e) => { L.border = e.target.checked; changed(); }); live('bdl-y', 'y'); live('bdl-haze', 'haze', (v) => Math.round(v * 100) + '%');
    on('bdl-speed', 'oninput', (e) => { L.speed = +e.target.value; $('bdl-speed-v').textContent = (+e.target.value).toFixed(2) + '×'; BD.pose(E.time); }); on('bdl-speed', 'onchange', () => changed(false));
    on('bdl-bob', 'oninput', (e) => { L.bob = +e.target.value; $('bdl-bob-v').textContent = e.target.value; BD.pose(E.time); }); on('bdl-bob', 'onchange', () => changed(false));
    on('bdl-kind', 'onchange', (e) => { L.kind = e.target.value; Object.assign(L, { speed: BD.KINDS[L.kind][1].speed, bob: BD.KINDS[L.kind][1].bob }); changed(); });
    on('bdl-style', 'onchange', (e) => { L.style = e.target.value || null; changed(); });
    on('bdl-auto', 'onchange', (e) => { L.color = e.target.checked ? null : $('bdl-color').value; changed(); });
    on('bdl-color', 'onchange', (e) => { L.color = e.target.value; changed(); });
    const mv = (k, id, field) => on(id, 'onchange', (e) => { L[k] = { ...(L[k] || {}), [field]: field === 'move' ? e.target.value : Math.max(0, +e.target.value || 0) }; changed(); });
    mv('enter', 'bdl-in', 'move'); mv('enter', 'bdl-in-at', 'at'); mv('enter', 'bdl-in-dur', 'dur'); mv('exit', 'bdl-out', 'move'); mv('exit', 'bdl-out-at', 'at'); mv('exit', 'bdl-out-dur', 'dur');
  }
  host && host.addEventListener('click', (e) => {
    const b = bd(), t = e.target.closest('[data-bd],[data-theme],[data-style],[data-pal],[data-mode],[data-la]'); if (!t || !E.doc) return;
    if (t.dataset.bd === 'new') { BD.random(); cur = null; changed(); return; }
    if (t.dataset.theme) { BD.useTheme(t.dataset.theme); cur = null; changed(); return; }
    if (t.dataset.bd === 'pic') { const l = b && b.layers.find((x) => x.id === cur); if (l) choosePicture(l); return; }
    if (!b) return;
    if (t.dataset.bd === 'shuffle') { BD.shuffle(); changed(); return; }
    if (t.dataset.bd === 'del') { b.layers = b.layers.filter((l) => l.id !== cur); cur = null; changed(); return; }
    if (t.dataset.bd === 'reseed') { const l = b.layers.find((x) => x.id === cur); if (l) l.seed = Math.floor(Math.random() * 1e6); changed(); return; }
    if (t.dataset.style) { b.style = t.dataset.style; changed(); return; }
    if (t.dataset.pal) { BD.applyPalette(t.dataset.pal); changed(); return; }
    if (t.dataset.mode) { b.mode = t.dataset.mode; changed(false); render(); return; }
    const row = t.closest('[data-l]'); if (!row) return;
    const i = b.layers.findIndex((l) => l.id === row.dataset.l), l = b.layers[i];
    if (t.dataset.la === 'vis') { l.visible = l.visible === false; changed(); }
    else if (t.dataset.la === 'back' && i > 0) { b.layers.splice(i, 1); b.layers.splice(i - 1, 0, l); changed(); }
    else if (t.dataset.la === 'front' && i < b.layers.length - 1) { b.layers.splice(i, 1); b.layers.splice(i + 1, 0, l); changed(); }
    else if (t.dataset.la === 'sel') { cur = cur === l.id ? null : l.id; render(); }
  });
  // your own picture for a Picture layer: kept in the scene file (made smaller if it is very big)
  const picInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true }); document.body.append(picInput);
  let picFor = null;
  function choosePicture(l) { picFor = l; picInput.value = ''; picInput.click(); }
  picInput.onchange = () => {
    const f = picInput.files[0], l = picFor; if (!f || !l) return;
    const rd = new FileReader();
    rd.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); l.src = c.toDataURL('image/png'); l.aspect = c.width / c.height; l.name = f.name; changed(); }; img.src = rd.result; };
    rd.readAsDataURL(f);
  };
  BD.setPicture = (l, src, aspect) => { l.src = src; l.aspect = aspect; changed(); };
  E.on('built', () => { BD.sync(); render(); });
  window.BD3UI = {
    render,
    newBackdrop: () => { if (!E.doc) return; BD.random(); cur = null; changed(); },
    shuffle: () => { if (!E.doc || !bd()) return; BD.shuffle(); changed(); },
    style: (s) => { if (!E.doc) return; BD.ensure().style = s; changed(); },
    palette: (p) => { if (!E.doc) return; BD.applyPalette(p); changed(); },
    clear: () => { if (!E.doc) return; delete E.doc.backdrop; cur = null; changed(); },
  };
})();
