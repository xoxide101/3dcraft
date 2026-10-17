/* 3DCraft interface: ribbon and menus, layers, the Add and Symbols tabs, properties, the corner dial, Picture to 3D,
   export, starter scenes, undo, autosave, save and open. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const r2 = (v) => Math.round(v * 100) / 100;
  const E = window.E3, T = window.THREE;
  const AUTOSAVE = '3dcraft-doc-v1';
  E.init($('stage'));

  // ------------------------------------------------------------------ messages
  const toastEl = $('toast'); let toastT;
  function toast(m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 3200); }
  E.onWarn = toast;
  function info(title, html) { $('info-title').textContent = title; $('info-body').innerHTML = html; $('info').hidden = false; $('info-close').focus(); }
  $('info-close').onclick = () => { $('info').hidden = true; };
  ['info', 'tracedlg', 'exportdlg'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Escape') $(id).hidden = true; }));

  // ------------------------------------------------------------------ history, autosave, changes
  let history = [], hIndex = -1, hTimer = null, dirty = false, fileName = null, autosaveFailed = false;
  const snapshot = () => JSON.stringify(E.doc);
  function resetHistory() { history = [snapshot()]; hIndex = 0; dirty = false; try { localStorage.setItem(AUTOSAVE, history[0]); } catch (e) {} }
  function changed(rebuildId) {
    if (!E.doc) return;
    dirty = true;
    if (rebuildId === true) E.rebuild(); else if (rebuildId) E.rebuildOne(rebuildId);
    clearTimeout(hTimer);
    hTimer = setTimeout(() => {
      const s = snapshot(); if (history[hIndex] === s) return;
      history = history.slice(0, hIndex + 1); history.push(s); if (history.length > 60) history.shift(); hIndex = history.length - 1;
      try { localStorage.setItem(AUTOSAVE, s); autosaveFailed = false; } catch (e) { autosaveFailed = true; }
      status(); tb && tb.update();
    }, 350);
    renderLayers(); status(); tb && tb.update(); if (window.TL3 && !TL3.playing()) TL3.render();
  }
  async function restore(s) { E.doc = JSON.parse(s); E.applyCamera(); await E.rebuild(); renderLayers(); showProps(); status(); }
  const undo = () => { if (hIndex > 0) { hIndex--; restore(history[hIndex]); } };
  const redo = () => { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); } };
  E.on('changed', () => { changed(); showProps(); });
  E.on('moving', () => { clearTimeout(movT); movT = setTimeout(showProps, 120); });
  let movT = null;
  E.on('camera', () => { dirty = true; clearTimeout(hTimer); hTimer = setTimeout(() => { try { localStorage.setItem(AUTOSAVE, snapshot()); } catch (e) {} }, 600); });
  E.on('select', () => { renderLayers(); showProps(); status(); tb && tb.update(); });
  E.on('view', () => { E.saveCamera(); drawRotator(); });
  E.on('drawn', () => drawRotator());

  // ------------------------------------------------------------------ adding things
  const sel = () => E.selectedId() && E.find(E.selectedId());
  const PALETTE = ['#3f7fe0', '#e8590c', '#2f9e44', '#c2255c', '#f59f00', '#7048e8', '#1098ad', '#e03131'];
  let colourTurn = 0;
  const nextColour = () => PALETTE[colourTurn++ % PALETTE.length];
  function standOnGround(m, h) { const n = E.doc.objects.filter((o) => !o.parent).length; m.pos = [((n % 5) - 2) * 0.6 * (n ? 1 : 0), h / 2, 0]; }
  function addObject(m) {
    m.id = E.uid(); m.parent = m.parent || null; m.visible = true; m.locked = false; m.rot = m.rot || [0, 0, 0]; m.scale = m.scale || [1, 1, 1];
    m.mat = m.mat || E.defaultMat(nextColour());
    E.doc.objects.push(m);
    E.rebuild().then(() => {
      // put it beside what is already there (not inside it), then show everything
      const o = E.object3d(m.id), others = new T.Box3();
      E.root().children.forEach((c) => { if (c !== o && c.visible) others.expandByObject(c); });
      if (o && !others.isEmpty()) { const b = new T.Box3().setFromObject(o); if (b.intersectsBox(others)) { m.pos[0] = r2(m.pos[0] + others.max.x - b.min.x + 0.4); E.placeOne(m.id); E.fit(); } }
      E.select(m.id); changed();
    });
    changed();
    return m;
  }
  function addShape(type, patch, name) {
    if (!E.doc) return;
    const s = { type, ...E.SHAPES[type][1], ...(patch || {}) };
    if (E.isObjectShape(type)) {
      // objects stand on the floor at their real height, with each part in its own colour
      const size = E.shapeSize(s), m = { kind: 'shape', name: name || E.SHAPES[type][0], shape: s, mat: { ...E.defaultMat('#9aa1ab', 'plastic'), faces: JSON.parse(JSON.stringify(E.PART_COLOURS[type] || {})) } };
      standOnGround(m, size.y);
      return addObject(m);
    }
    const h = type === 'stage' ? s.h * s.steps : type === 'sphere' ? s.r * 2 : type === 'torus' ? s.r * 2 + s.tube * 2 : ['star', 'heart', 'washer'].includes(type) ? s.r * 2 : type === 'plane' ? s.h : type === 'capsule' ? s.h + s.r * 2 : s.h || 2;
    const m = { kind: 'shape', name: E.SHAPES[type][0], shape: s };
    standOnGround(m, h);
    if (type === 'plane') m.pos[1] = s.h / 2;
    if (type === 'stage') { m.pos = [0, h / 2, 0]; m.mat = E.defaultMat('#8c96a3', 'matte'); }
    return addObject(m);
  }
  const FONT3D = () => (window.CRAFT_FONTS3D || []).map(([f]) => f);
  function addText(text = '3D TEXT', o = {}) {
    if (!E.doc) return;
    const m = { kind: 'text', name: 'Text', text: { text, font: o.font || 'Archivo Black', bold: false, size: o.size || 1.2, depth: o.depth || 0.4, bevel: o.bevel ?? 0.03, spacing: 0, align: 'center', lead: 1.15 }, mat: o.mat };
    standOnGround(m, m.text.size * 0.8);
    return addObject(m);
  }
  function addSymbol(r) {
    if (!E.doc) return;
    const font = r.kind === 'emoji' ? 'Noto Emoji' : 'Noto Sans Symbols 2';
    const m = addText(r.char, { font, size: 2, depth: 0.5, bevel: 0.03 });
    m.name = (r.kind === 'emoji' ? 'Emoji: ' : 'Symbol: ') + (r.name || r.char);
    renderLayers();
  }
  async function importModel(file) {
    try { const m = await E.importFile(file); standOnGround(m, 3); m.mat = E.defaultMat('#bfc5cc', 'plastic'); addObject(m); toast(`${file.name} is in the scene.`); }
    catch (e) { info('Could not open that file', esc(e.message)); }
  }

  // ------------------------------------------------------------------ layers
  const EYE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".5"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><path d="M4 4l16 16"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const UNLOCK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".45"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>';
  const picked = new Set(); // layers ticked for grouping (Ctrl+click)
  const layerName = (m) => m.name || m.kind;
  function renderLayers() {
    if (!E.doc) { $('layers').innerHTML = ''; return; }
    const cur = E.selectedId(), rows = [];
    const walk = (pid, depth) => E.children(pid).slice().reverse().forEach((m) => { rows.push([m, depth]); if (m.kind === 'group' && !m.closed) walk(m.id, depth + 1); });
    walk(null, 0);
    $('layers').innerHTML = rows.map(([m, d]) => `<div class="layer${m.id === cur || picked.has(m.id) ? ' on' : ''}${m.visible === false ? ' off' : ''}" data-id="${m.id}" style="margin-left:${d * 14}px">`
      + `<button class="lb" data-act="vis" title="${m.visible === false ? 'Show' : 'Hide'}">${m.visible === false ? EYE_OFF : EYE}</button>`
      + `<button class="lb" data-act="lock" title="${m.locked ? 'Unlock' : 'Lock (cannot be clicked or moved)'}">${m.locked ? LOCK : UNLOCK}</button>`
      + `<span class="ln" data-act="sel" title="Click to select, Ctrl+click to pick several, double-click to rename">${m.kind === 'group' ? (m.closed ? '▸ ' : '▾ ') : ''}${esc(layerName(m))}</span>`
      + `<button class="lb" data-act="up" title="Up the list">▲</button><button class="lb" data-act="down" title="Down the list">▼</button></div>`).join('')
      || '<p class="hint">Nothing here yet. Use the Add tab or the Insert tab to add shapes, 3D text or a picture.</p>';
    $('layer-tools').innerHTML = `<div class="row"><button class="btn outline" id="ly-group" title="Ctrl+click layers to pick them first">Group</button><button class="btn outline" id="ly-ungroup">Ungroup</button></div>
      <div class="row"><button class="btn outline" id="ly-dup">Duplicate</button><button class="btn outline" id="ly-del">Delete</button></div><p class="hint">Ctrl+click layers to pick several, then Group. Double-click a name to rename it.</p>`;
    $('ly-group').onclick = groupPicked; $('ly-ungroup').onclick = ungroup; $('ly-dup').onclick = duplicate; $('ly-del').onclick = del;
  }
  $('layers').onclick = (e) => {
    const row = e.target.closest('.layer'); if (!row) return;
    const m = E.find(row.dataset.id), act = e.target.closest('[data-act]')?.dataset.act; if (!m) return;
    if (act === 'vis') { m.visible = m.visible === false; E.placeOne(m.id); changed(); }
    else if (act === 'lock') { m.locked = !m.locked; if (m.locked && E.selectedId() === m.id) E.select(null); changed(); }
    else if (act === 'up' || act === 'down') { const sibs = E.doc.objects; const i = sibs.indexOf(m); const j = act === 'up' ? sibs.findIndex((o, k) => k > i && (o.parent || null) === (m.parent || null)) : sibs.map((o, k) => [o, k]).filter(([o, k]) => k < i && (o.parent || null) === (m.parent || null)).map(([, k]) => k).pop(); if (j >= 0 && j != null) { sibs.splice(i, 1); sibs.splice(j, 0, m); changed(); } }
    else if (e.ctrlKey || e.metaKey) { picked.has(m.id) ? picked.delete(m.id) : picked.add(m.id); renderLayers(); }
    else if (m.kind === 'group' && e.target.closest('.ln') && e.offsetX < 14) { m.closed = !m.closed; renderLayers(); }
    else { picked.clear(); if (!m.locked) E.select(m.id); }
  };
  $('layers').ondblclick = (e) => {
    const row = e.target.closest('.layer'); if (!row) return;
    const m = E.find(row.dataset.id), span = row.querySelector('.ln');
    const inp = document.createElement('input'); inp.className = 'input'; inp.value = m.name || '';
    span.replaceWith(inp); inp.focus(); inp.select();
    inp.onblur = () => { m.name = inp.value.trim() || m.name; changed(); showProps(); };
    inp.onkeydown = (k) => { k.stopPropagation(); if (k.key === 'Enter') inp.blur(); if (k.key === 'Escape') { inp.value = m.name; inp.blur(); } };
  };
  function groupPicked() {
    const ids = [...picked].filter((id) => E.find(id)); if (E.selectedId() && !ids.includes(E.selectedId())) ids.push(E.selectedId());
    if (ids.length < 2) return toast('Ctrl+click two or more layers in the list first.');
    const g = { id: E.uid(), kind: 'group', name: 'Group', parent: null, visible: true, locked: false, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], mat: E.defaultMat() };
    E.doc.objects.push(g); ids.forEach((id) => { E.find(id).parent = g.id; }); picked.clear();
    changed(true); E.rebuild().then(() => E.select(g.id));
  }
  function ungroup() {
    const g = sel(); if (!g || g.kind !== 'group') return toast('Select a group first.');
    const o = E.object3d(g.id);
    E.children(g.id).forEach((m) => { // keep where each piece is, now relative to the scene
      const c = E.object3d(m.id); if (c && o) { c.updateMatrixWorld(); const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); c.matrixWorld.decompose(p, q, s); const eu = new T.Euler().setFromQuaternion(q); m.pos = p.toArray(); m.rot = [eu.x, eu.y, eu.z].map((v) => (v * 180) / Math.PI); m.scale = s.toArray(); }
      m.parent = g.parent || null;
    });
    E.doc.objects = E.doc.objects.filter((x) => x !== g); E.select(null); changed(true);
  }
  function duplicate() {
    const m = sel(); if (!m) return;
    const copy = (src, parent) => { const n = JSON.parse(JSON.stringify(src)); n.id = E.uid(); n.parent = parent; n.name = src.name + (parent === src.parent ? ' copy' : ''); if (parent === src.parent) n.pos = [n.pos[0] + 0.6, n.pos[1], n.pos[2] + 0.6]; E.doc.objects.push(n); E.children(src.id).forEach((c) => copy(c, n.id)); return n; };
    const n = copy(m, m.parent || null);
    E.rebuild().then(() => E.select(n.id)); changed();
  }
  function del() {
    const m = sel(); if (!m) return;
    const gone = new Set([m.id]); let grew = true; while (grew) { grew = false; E.doc.objects.forEach((o) => { if (o.parent && gone.has(o.parent) && !gone.has(o.id)) { gone.add(o.id); grew = true; } }); }
    E.doc.objects = E.doc.objects.filter((o) => !gone.has(o.id)); E.select(null); changed(true);
  }
  let clipboard = null;
  const copySel = () => { const m = sel(); if (m) { clipboard = JSON.stringify(m); toast('Copied.'); } };
  const paste = () => { if (!clipboard || !E.doc) return; const n = JSON.parse(clipboard); n.id = E.uid(); n.parent = null; n.pos = [n.pos[0] + 0.8, n.pos[1], n.pos[2] + 0.8]; E.doc.objects.push(n); E.rebuild().then(() => E.select(n.id)); changed(); };

  // ------------------------------------------------------------------ the Add tab
  const SH_ICON = {
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8" opacity=".6"/>',
    roundbox: '<rect x="4" y="5" width="16" height="14" rx="4"/><path d="M8 5c-2 2-2 12 0 14" opacity=".5"/>',
    sphere: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3" opacity=".5"/>',
    cylinder: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>',
    cone: '<path d="M12 3L5 18M12 3l7 15"/><ellipse cx="12" cy="18" rx="7" ry="2.5"/>',
    pyramid: '<path d="M12 3L3 18h18zM12 3l3 15" />',
    prism: '<path d="M7 4h10l4 3v10l-4 3H7l-4-3V7z"/><path d="M7 4v16M17 4v16" opacity=".5"/>',
    torus: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="11.5" rx="3.5" ry="1.8"/>',
    washer: '<ellipse cx="12" cy="11" rx="9" ry="5"/><ellipse cx="12" cy="11" rx="4" ry="2"/><path d="M3 11v2c0 2.8 4 5 9 5s9-2.2 9-5v-2" opacity=".6"/>',
    capsule: '<rect x="7" y="3" width="10" height="18" rx="5"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
    plane: '<path d="M3 15l6-6h12l-6 6z"/>',
    stage: '<ellipse cx="12" cy="13" rx="9" ry="3.2"/><path d="M3 13v3c0 1.8 4 3.2 9 3.2s9-1.4 9-3.2v-3"/><path d="M9 11V6l3-2 3 2v5" opacity=".6"/>',
  };
  const ICON = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  // ready-made objects: [label, shape type, settings]
  const OBJECTS = [['Palm tree', 'palm', {}, 'palm'], ['Round table', 'table', { top: 'round', base: 'pedestal' }, 'table'], ['Square table', 'table', { top: 'square', base: 'legs' }, 'table4'], ['Long table', 'table', { top: 'rect', base: 'legs', w: 6, d: 3 }, 'table4'],
    ['Computer monitor', 'monitor', {}, 'monitor'], ['TV (43 inch)', 'tv', { size: 43 }, 'tv'], ['TV (65 inch)', 'tv', { size: 65 }, 'tv'], ['CRT TV', 'crt', {}, 'crt'], ['Test boat', 'boat', {}, 'boat']];
  const SCENERY_ICON = {"rock": "<path d=\"M4 17l3-7 5-3 6 3 2 7z\"/><path d=\"M7 10l4 3 7-3\" opacity=\".5\"/>", "asteroid": "<path d=\"M5 9l5-4 7 2 3 6-4 6-7 0-4-4z\"/><circle cx=\"11\" cy=\"11\" r=\"1.6\"/><circle cx=\"15\" cy=\"15\" r=\"1\"/>", "crater": "<ellipse cx=\"12\" cy=\"15\" rx=\"9\" ry=\"3.5\"/><ellipse cx=\"12\" cy=\"15\" rx=\"5\" ry=\"1.8\" class=\"hue\"/>", "rocket": "<path d=\"M12 2c3 3 4 7 3 12h-6C8 9 9 5 12 2z\"/><path d=\"M9 14l-3 4h4M15 14l3 4h-4\"/><circle cx=\"12\" cy=\"9\" r=\"1.5\" class=\"hue\"/>", "ufo": "<ellipse cx=\"12\" cy=\"13\" rx=\"10\" ry=\"3\"/><path d=\"M8 12a4 4 0 0 1 8 0\"/><path d=\"M7 18l-1 2M17 18l1 2\" class=\"hue\"/>", "sailboat": "<path d=\"M4 17h16l-3 3H7z\"/><path d=\"M12 3v14M12 4l-6 11h6M13 6l5 9h-5\" class=\"hue\"/>", "lighthouse": "<path d=\"M9 21l1.5-14h3L15 21z\"/><path d=\"M9.5 15h5M10 11h4\"/><rect x=\"10\" y=\"4\" width=\"4\" height=\"3\" class=\"hue\"/>", "umbrella": "<path d=\"M3 11a9 7 0 0 1 18 0z\"/><path d=\"M12 11v10\"/><path d=\"M8 11l4-7 4 7\" class=\"hue\"/>", "chip": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\"/><path d=\"M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3\"/>", "capacitor": "<rect x=\"8\" y=\"3\" width=\"8\" height=\"13\" rx=\"2\"/><path d=\"M10 16v5M14 16v5\"/><path d=\"M14 4v11\" class=\"hue\"/>", "streetlamp": "<path d=\"M8 21V4h8\"/><path d=\"M14 4l3 3h-6z\" class=\"hue\"/><path d=\"M6 21h4\"/>", "bench": "<path d=\"M3 13h18M3 9h18M5 13v6M19 13v6M5 9V7M19 9V7\"/>", "trafficcone": "<path d=\"M9 4h6l4 15H5z\"/><path d=\"M7.5 10h9M6.5 14h11\" class=\"hue\"/><path d=\"M3 19h18\"/>", "pine3d": "<path d=\"M12 2l5 7h-3l4 6H6l4-6H7z\"/><path d=\"M12 15v6\"/>", "stump": "<ellipse cx=\"12\" cy=\"8\" rx=\"6\" ry=\"2.5\"/><path d=\"M6 8v8c0 1.5 3 2.5 6 2.5s6-1 6-2.5V8\"/><ellipse cx=\"12\" cy=\"8\" rx=\"3\" ry=\"1.2\" class=\"hue\"/>", "mushroom": "<path d=\"M3 12a9 7 0 0 1 18 0z\" class=\"hue\"/><path d=\"M10 12v7h4v-7\"/>", "cactus": "<path d=\"M10 21V5a2 2 0 0 1 4 0v16\"/><path d=\"M10 13H7V9M14 11h3V7\"/>", "bush": "<path d=\"M5 17a4 4 0 0 1 1-7 5 5 0 0 1 9-2 4 4 0 0 1 4 6 3 3 0 0 1-1 3z\"/>", "fence": "<path d=\"M5 20V6l1.5-2L8 6v14M11 20V6l1.5-2L14 6v14M17 20V6l1.5-2L20 6v14M3 10h19M3 15h19\"/>"};
  const OBJ_ICON = {"palm": "<path d=\"M12 21c0-5 1-9 2-12\"/><path d=\"M14 9c-3-3-7-3-9-1M14 9c3-3 7-2 8 0M14 9c-1-3-4-5-6-5M14 9c1-3 4-4 6-3\" class=\"hue\"/>", "table": "<ellipse cx=\"12\" cy=\"8\" rx=\"9\" ry=\"2.5\"/><path d=\"M12 10.5V19M7 20l5-1.5 5 1.5\"/>", "table4": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"3\" rx=\"1\"/><path d=\"M5 9v11M19 9v11M8 9v8M16 9v8\" opacity=\".8\"/>", "monitor": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"1.5\"/><path d=\"M12 16v3M8 20h8\"/>", "tv": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"12\" rx=\"1\"/><path d=\"M6 17l-1 3M18 17l1 3\"/>", "crt": "<rect x=\"3\" y=\"5\" width=\"16\" height=\"13\" rx=\"2\"/><rect x=\"5\" y=\"7\" width=\"10\" height=\"8\" rx=\"2\"/><path d=\"M17 9v1M17 12v1\"/><path d=\"M19 8l2 2v6l-2 1\" opacity=\".6\"/>", "boat": "<path d=\"M3 15h18l-3 4H6z\"/><rect x=\"8\" y=\"10\" width=\"7\" height=\"5\"/><path d=\"M9 10V7h4v3M15 7v3\" opacity=\".7\"/>"};
  $('addgrid').innerHTML = '<h4>Shapes</h4>' + Object.entries(E.SHAPES).filter(([k]) => !E.isObjectShape(k)).map(([k, [n]]) => `<button type="button" data-add="${k}" title="Add a ${n.toLowerCase()}">${ICON(SH_ICON[k])}${n}</button>`).join('')
    + '<h4>Scenery</h4>' + E.SCENERY.map((k) => `<button type="button" data-add="${k}" title="Add a ${E.SHAPES[k][0].toLowerCase()}">${ICON(SCENERY_ICON[k])}${E.SHAPES[k][0]}</button>`).join('')
    + '<h4>Objects</h4>' + OBJECTS.map(([n, , , ic], i) => `<button type="button" data-obj="${i}" title="Add a ${n.toLowerCase()}">${ICON(OBJ_ICON[ic])}${n}</button>`).join('')
    + `<h4>Words and pictures</h4><button type="button" data-add="text">${ICON('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>')}3D text</button><button type="button" data-add="cutout">${ICON('<path d="M5 19c2-6 5-9 7-14 2 5 5 8 7 14z"/><path d="M8 19l4-6 4 6" opacity=".6"/>')}Photo cut-out</button><button type="button" data-add="trace">${ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="2"/>')}Picture to 3D</button><button type="button" data-add="model">${ICON('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" opacity=".6"/>')}3D file…</button>`;
  $('addgrid').onclick = (e) => { const ob = e.target.closest('[data-obj]'); if (ob) { const [n, t, patch] = OBJECTS[+ob.dataset.obj]; addShape(t, patch, n); return; } const b = e.target.closest('[data-add]'); if (!b) return; const k = b.dataset.add; if (k === 'text') addText(); else if (k === 'trace') openTrace(); else if (k === 'cutout') photoCutout(); else if (k === 'model') $('model-input').click(); else addShape(k); };
  $('model-input').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importModel(f); };
  CraftSymbols.mount($('sym-panel'), { onPick: addSymbol });
  document.querySelectorAll('.tabs .tab').forEach((t) => { t.onclick = () => showTab(t.dataset.tab); });
  function showTab(name) { document.querySelectorAll('.tabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name))); ['layers', 'add', 'symbols', 'backdrop', 'ground'].forEach((n) => { $('tab-' + n).hidden = n !== name; }); }

  // ------------------------------------------------------------------ properties (built from a short description)
  let bind = [];
  function field(f) {
    const id = f.id || 'f' + Math.random().toString(36).slice(2, 8);
    f._id = id; bind.push(f);
    const lab = (inner) => `<label class="field"><span>${f.label}</span>${inner}</label>`;
    switch (f.t) {
      case 'text': return lab(`<input class="input" id="${id}" value="${esc(f.value)}">`);
      case 'area': return lab(`<textarea class="input" id="${id}" rows="${f.rows || 3}">${esc(f.value)}</textarea>`);
      case 'num': return lab(`<input class="input" type="number" id="${id}" value="${f.value ?? ''}" step="${f.step || 1}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}>`);
      case 'color': return lab(`<input class="input" type="color" id="${id}" value="${/^#[0-9a-f]{6}$/i.test(f.value || '') ? f.value : '#888888'}">`);
      case 'select': return lab(`<select class="input" id="${id}">${f.options.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`);
      case 'font3d': { const groups = {}; (window.CRAFT_FONTS3D || []).forEach(([n, g]) => (groups[g] = groups[g] || []).push(n)); return lab(`<select class="input" id="${id}">${Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((n) => `<option ${n === f.value ? 'selected' : ''} style="font-family:'${esc(n)}'">${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>`); }
      case 'range': return `<label class="field"><span>${f.label}: <b id="${id}-v">${f.show ? f.show(f.value) : f.value}</b></span><input type="range" id="${id}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.value}"></label>`;
      case 'check': return `<label class="check"><input type="checkbox" id="${id}" ${f.value ? 'checked' : ''}> ${f.label}</label>`;
      case 'seg': return (f.label ? `<span class="hint">${f.label}</span>` : '') + `<div class="seg" role="group">${f.buttons.map((b, i) => `<button class="btn" id="${id}-${i}" aria-pressed="${!!b.pressed}" title="${esc(b.title || b.label)}">${b.label}</button>`).join('')}</div>`;
      case 'btns': return `<div class="row">${f.buttons.map((b, i) => `<button class="btn ${b.cls || 'outline'}" id="${id}-${i}" title="${esc(b.title || '')}">${b.label}</button>`).join('')}</div>`;
      case 'row': return `<div class="row">${f.items.filter(Boolean).map(field).join('')}</div>`;
      case 'xyz': return `<div class="field"><span>${f.label}</span><div class="xyz">${['X', 'Y', 'Z'].map((a, i) => `<label class="field"><span style="color:${['#e03131', '#2f9e44', '#1c7ed6'][i]}">${a}</span><input class="input" type="number" id="${id}-${i}" value="${f.value[i]}" step="${f.step || 0.1}"></label>`).join('')}</div></div>`;
      case 'html': return `<div id="${id}"></div>`;
      case 'note': return `<p class="${f.cls || 'hint'}">${f.html}</p>`;
      default: return '';
    }
  }
  function render(title, sections) {
    bind = [];
    const html = `<div class="props-head">${esc(title)}</div>` + sections.filter(Boolean).map((s) => `<div class="sec">${s.title ? `<h3>${s.title}</h3>` : ''}${s.items.filter(Boolean).map(field).join('')}</div>`).join('');
    const keep = document.activeElement && $('props').contains(document.activeElement) ? document.activeElement.id : null;
    $('props').innerHTML = html;
    bind.forEach((f) => {
      const el = $(f._id);
      if (f.t === 'seg' || f.t === 'btns') return f.buttons.forEach((b, i) => { const x = $(`${f._id}-${i}`); if (x) x.onclick = b.on; });
      if (f.t === 'xyz') return [0, 1, 2].forEach((i) => { const x = $(`${f._id}-${i}`); x.onchange = () => { const v = f.value.slice(); v[i] = +x.value || 0; f.on(v); }; });
      if (f.t === 'html') return f.mount && f.mount(el);
      if (!el || !f.on) return;
      if (f.t === 'check') el.onchange = () => f.on(el.checked);
      else if (f.t === 'range') { el.oninput = () => { $(f._id + '-v').textContent = f.show ? f.show(+el.value) : el.value; f.live && f.on(+el.value, true); }; el.onchange = () => f.on(+el.value, false); }
      else if (f.t === 'num') el.onchange = () => f.on(el.value === '' ? null : +el.value);
      else if (f.t === 'text' || f.t === 'area') { if (f.live) el.oninput = () => f.on(el.value, true); el.onchange = () => f.on(el.value, false); }
      else if (f.t === 'color') { el.oninput = () => f.on(el.value, true); el.onchange = () => f.on(el.value, false); }
      else el.onchange = () => f.on(el.value);
    });
    if (keep && $(keep)) { const el = $(keep); el.focus(); }
  }

  // what the selected object is made of
  function materialSection(m) {
    const put = (patch) => Object.entries(patch).forEach(([k, v]) => { if ((k === 'color' || k === 'opacity') && E.isAnimated(m, k)) E.setValue(m, k, v); else mat[k] = v; });
    const mat = m.mat, set = (patch) => { put(patch); changed(m.id); showProps(); if (window.TL3) TL3.render(); };
    const live = (patch) => { put(patch); E.rebuildOne(m.id); };
    const slots = E.slotsFor(m);
    let face = materialSection.face && (slots.includes(materialSection.face) || materialSection.face === 'all') ? materialSection.face : 'all';
    // each button shows a little ball rendered in that material (in this object's colour, unless the material has its own)
    const ballFor = (k) => E.materialPreview(k, E.MATERIALS[k][1].color || mat.color);
    return { title: 'Material', items: [
      { t: 'html', mount: (el) => { el.className = 'mat-presets'; el.innerHTML = Object.entries(E.MATERIALS).map(([k, [n]]) => `<button type="button" data-mp="${k}" title="${n}" aria-pressed="${mat.preset === k}"><img alt="" src="${ballFor(k)}"><span>${n.replace('Glossy paint', 'Gloss')}</span></button>`).join(''); el.onclick = (e) => { const b = e.target.closest('[data-mp]'); if (!b) return; const p = E.MATERIALS[b.dataset.mp][1]; set({ preset: b.dataset.mp, spec: 1, sheen: 0, ior: 1.5, waves: 0, ...p }); }; } },
      { t: 'row', items: [{ t: 'color', label: 'Colour', value: mat.color, on: (v, l) => (l ? live({ color: v }) : set({ color: v })) }, m.kind === 'trace' ? { t: 'check', label: "Picture's own colours", value: m.trace.ownColours !== false, on: (v) => { m.trace.ownColours = v; changed(m.id); showProps(); } } : null] },
      { t: 'range', label: 'Shine', value: Math.round((1 - (mat.rough ?? 0.4)) * 100), min: 0, max: 100, show: (v) => v + '%', on: (v) => set({ rough: 1 - v / 100 }) },
      { t: 'range', label: 'Metal', value: Math.round((mat.metal ?? 0) * 100), min: 0, max: 100, show: (v) => v + '%', on: (v) => set({ metal: v / 100 }) },
      { t: 'range', label: 'Glass (see-through)', value: Math.round((mat.glass ?? 0) * 100), min: 0, max: 100, show: (v) => v + '%', on: (v) => set({ glass: v / 100 }) },
      { t: 'range', label: 'Glow', value: Math.round((mat.glow ?? 0) * 50), min: 0, max: 100, show: (v) => v + '%', on: (v) => set({ glow: v / 50 }) },
      { t: 'range', label: 'Opacity', value: Math.round((mat.opacity ?? 1) * 100), min: 5, max: 100, show: (v) => v + '%', on: (v) => set({ opacity: v / 100 }) },
      { t: 'select', label: 'Colour cycling (moving bands of colour; plays with the timeline)', value: (mat.cycle && mat.cycle.preset) || 'none', options: [['none', 'Off'], ...Object.entries(E.CYCLES).map(([k, [n]]) => [k, n])], on: (v) => { mat.cycle = v === 'none' ? null : { speed: 1, dir: 'up', front: m.kind === 'text', part: E.slotsFor(m).includes('screen') ? 'screen' : null, ...(mat.cycle || {}), preset: v, bands: (E.CYCLES[v] && E.CYCLES[v][1] && E.CYCLES[v][2]) ? E.CYCLES[v][1].length : 8 }; changed(m.id); showProps(); if (v !== 'none' && window.TL3 && !TL3.playing()) TL3.play(); } },
      mat.cycle ? { t: 'row', items: [{ t: 'num', label: 'Speed (bands a second)', value: mat.cycle.speed ?? 1, step: 0.25, on: (v) => { mat.cycle.speed = v ?? 1; changed(m.id); } }, { t: 'num', label: 'Bands', value: mat.cycle.bands ?? 8, min: 1, max: 64, on: (v) => { mat.cycle.bands = Math.max(1, Math.min(64, v | 0 || 8)); changed(m.id); } }] } : null,
      mat.cycle ? { t: 'seg', label: 'They move', buttons: [['up', 'Up'], ['down', 'Down'], ['updown', 'Up and down'], ['left', 'Left'], ['right', 'Right'], ['sideways', 'Side to side']].map(([v, n]) => ({ label: n, pressed: (mat.cycle.dir || 'up') === v, on: () => { mat.cycle.dir = v; changed(m.id); showProps(); } })) } : null,
      mat.cycle && E.slotsFor(m).includes('screen') ? { t: 'check', label: 'Only on the screen', value: mat.cycle.part === 'screen', on: (v) => { mat.cycle.part = v ? 'screen' : null; changed(m.id); } } : null,
      mat.cycle && (m.kind === 'text' || m.kind === 'trace') ? { t: 'check', label: 'Only on the front', value: !!mat.cycle.front, on: (v) => { mat.cycle.front = v; changed(m.id); } } : null,
      slots.length || m.kind === 'shape' || m.kind === 'model' ? { t: 'select', label: 'Picture or gradient on', value: face, options: [['all', 'Every face'], ...slots.map((s) => [s, s[0].toUpperCase() + s.slice(1)])], on: (v) => { materialSection.face = v; showProps(); } } : null,
      { t: 'range', label: 'Relief (emboss) on pictures, patterns and gradients', value: Math.round((mat.relief || 0) * 100), min: 0, max: 300, step: 5, show: (v) => (v ? v + '%' : 'flat'), on: (v) => set({ relief: v / 100 }) },
      (mat.relief || 0) > 0 ? { t: 'check', label: 'Raise the dark parts (instead of the light ones)', value: !!mat.reliefDark, on: (v) => set({ reliefDark: v }) } : null,
      { t: 'html', mount: (el) => { el.append(paintPicker((mat.faces || {})[face] || { type: 'none' }, (f) => { mat.faces = { ...(mat.faces || {}) }; if (f.type === 'none') delete mat.faces[face]; else mat.faces[face] = f; changed(m.id); showProps(); }, { none: 'Plain', unit: 'mm', label: face === 'all' ? 'Every face' : face[0].toUpperCase() + face.slice(1), base: mat.color })); } },
    ] };
  }
  function transformSection(m) {
    const set = (k, v) => { E.setValue(m, k, v); E.placeOne(m.id); changed(); if (window.TL3) TL3.render(); };
    const cur = (k) => E.valueAt(m, k, E.time), anim = (k) => (E.isAnimated(m, k) ? ' ◆' : '');
    const uni = cur('scale')[0] === cur('scale')[1] && cur('scale')[1] === cur('scale')[2];
    return { title: 'Position, turn and size', items: [
      { t: 'xyz', label: 'Position' + anim('pos'), value: cur('pos').map(r2), on: (v) => set('pos', v) },
      { t: 'xyz', label: 'Turn (degrees)' + anim('rot'), value: cur('rot').map((x) => Math.round(x)), step: 5, on: (v) => set('rot', v) },
      uni ? { t: 'range', label: 'Size' + anim('scale'), value: Math.round(cur('scale')[0] * 100), min: 5, max: 500, show: (v) => v + '%', on: (v) => set('scale', [v / 100, v / 100, v / 100]) } : null,
      { t: 'xyz', label: 'Stretch' + anim('scale'), value: cur('scale').map(r2), on: (v) => set('scale', v.map((x) => Math.max(0.01, x))) },
      { t: 'btns', buttons: [{ label: 'Stand on the ground', on: dropToGround }, { label: 'Centre', on: () => { m.pos = [0, m.pos[1], 0]; E.placeOne(m.id); changed(); showProps(); } }, { label: 'Reset turn', on: () => set('rot', [0, 0, 0]) }] },
    ] };
  }
  // Letter by letter: each letter of a 3D text comes in, goes out, or keeps moving, one after another
  function setLetters(m, style) {
    const a = E.anim(), tr = E.track(m.id, true), had = !!tr.letters;
    if (!style) { delete tr.letters; if (had) E.rebuildOne(m.id); changed(); return; }
    const n = [...String(m.text.text || '').replace(/\s/g, '')].length || 1;
    const L = (tr.letters = { mode: 'in', start: tr.start ?? 0, each: 0.5, gap: 0.08, order: 'left', amount: 1, speed: 2, ...(tr.letters || {}), style });
    if (L.leave == null) L.leave = +Math.max(L.start, (tr.end ?? a.length) - E.lettersSpan(L, n) - 0.1).toFixed(2);
    if (!had) E.rebuildOne(m.id); else E.evalAt(E.time);
    changed();
  }
  function lettersSection(m) {
    const tr = E.anim().tracks[m.id], L = tr && tr.letters, kind = L && (E.LETTER_STYLES[L.style] || [])[1];
    const n = [...String(m.text.text || '').replace(/\s/g, '')].length || 1;
    const set = (patch) => { Object.assign(L, patch); E.evalAt(E.time); changed(); showProps(); if (window.TL3) TL3.render(); };
    const sec = (v) => (+v).toFixed(2) + ' s';
    const items = [{ t: 'select', label: 'Letters move one by one', value: L ? L.style : '', options: [['', 'No (the words move as one)'], ...Object.entries(E.LETTER_STYLES).map(([k, [nm]]) => [k, nm])], on: (v) => { setLetters(m, v); showProps(); if (window.TL3) TL3.render(); if (v && window.TL3 && !TL3.playing()) { TL3.seek(0); TL3.play(); } } }];
    if (L && kind === 'in') items.push(
      { t: 'seg', buttons: [['in', 'Come in'], ['out', 'Go out'], ['both', 'Both']].map(([v, label]) => ({ label, pressed: (L.mode || 'in') === v, on: () => set({ mode: v }) })) },
      { t: 'row', items: [L.mode !== 'out' ? { t: 'num', label: 'Start at (s)', value: L.start ?? 0, min: 0, step: 0.1, on: (v) => set({ start: Math.max(0, v || 0) }) } : null, L.mode !== 'in' ? { t: 'num', label: 'Leave at (s)', value: L.leave ?? 0, min: 0, step: 0.1, on: (v) => set({ leave: Math.max(0, v || 0) }) } : null] },
      { t: 'range', label: 'Each letter takes', value: L.each ?? 0.5, min: 0.05, max: 3, step: 0.05, show: sec, on: (v) => set({ each: v }) },
      { t: 'range', label: 'Next letter starts after', value: L.gap ?? 0.08, min: 0, max: 1, step: 0.01, show: sec, on: (v) => set({ gap: v }) });
    if (L && kind === 'loop') items.push(
      { t: 'range', label: 'One wave takes', value: L.speed ?? 2, min: 0.3, max: 10, step: 0.1, show: sec, on: (v) => set({ speed: v }) },
      { t: 'range', label: 'Each letter behind the last by', value: L.gap ?? 0.08, min: 0, max: 0.5, step: 0.01, show: (v) => Math.round(v * 100) + '% of a wave', on: (v) => set({ gap: v }) });
    if (L) items.push(
      { t: 'row', items: [{ t: 'select', label: 'Order', value: L.order || 'left', options: Object.entries(E.LETTER_ORDERS), on: (v) => set({ order: v }) },
        L.style !== 'type' && L.style !== 'fade' && L.style !== 'sweep' ? { t: 'range', label: 'How far', value: Math.round((L.amount ?? 1) * 100), min: 10, max: 300, step: 10, show: (v) => v + '%', on: (v) => set({ amount: v / 100 }) } : null] },
      { t: 'note', html: kind === 'loop' ? 'Keeps going for the whole time the layer shows.' : `All ${n} letters take ${E.lettersSpan(L, n).toFixed(2)} s. The Letters row on the timeline shows when; drag it to move it.` });
    return { title: 'Letter by letter', items };
  }
  function dropToGround() { const m = sel(); if (!m) return; const o = E.object3d(m.id); const b = new T.Box3().setFromObject(o); m.pos[1] = r2(m.pos[1] - b.min.y); E.placeOne(m.id); changed(); showProps(); }
  function showProps() {
    if (!E.doc) { $('props').innerHTML = ''; return; }
    const m = sel();
    if (!m) return sceneProps();
    const sections = [{ title: '', items: [{ t: 'text', label: 'Name', value: m.name, on: (v) => { m.name = v || m.name; changed(); } }] }];
    if (m.kind === 'shape') {
      const s = m.shape, re = (patch) => { Object.assign(s, patch); changed(m.id); showProps(); };
      const num = (k, label, min = 0.05, step = 0.1) => ({ t: 'num', label, value: s[k] ?? E.SHAPES[s.type][1][k], min, step, on: (v) => re({ [k]: Math.max(min, v || min) }) });
      const P = E.SHAPES[s.type][1], F = E.SHAPES[s.type][2];
      const fieldItems = (F || []).map(([k, label, a, b, step]) => (typeof a === 'object'
        ? { t: 'select', label, value: s[k] ?? P[k], options: Object.entries(a), on: (v) => re({ [k]: v }) }
        : { t: 'range', label, value: s[k] ?? P[k], min: a, max: b, step, on: (v) => re({ [k]: v }) }));
      if (F) {
        sections.push({ title: E.SHAPES[s.type][0], items: [...fieldItems, { t: 'note', html: 'Each part (' + E.slotsFor(m).join(', ') + ') can have its own colour, picture or pattern: Material › Picture or gradient on.' + (s.type === 'monitor' || s.type === 'tv' || s.type === 'crt' ? ' Put a picture on the <b>screen</b> and it lights up.' : '') }] });
      } else sections.push({ title: 'Shape', items: [
        { t: 'select', label: 'Shape', value: s.type, options: Object.entries(E.SHAPES).filter(([k]) => !E.isObjectShape(k)).map(([k, [n]]) => [k, n]), on: (v) => { m.shape = { type: v, ...E.SHAPES[v][1] }; m.name = E.SHAPES[v][0]; changed(m.id); showProps(); } },
        { t: 'row', items: [P.w != null ? num('w', 'Width') : null, P.h != null ? num('h', 'Height') : null, P.d != null && !(s.type === 'stage' && !['oval', 'rect'].includes(s.form)) ? num('d', 'Depth') : null] },
        { t: 'row', items: [P.r != null ? num('r', 'Radius') : null, P.tube != null ? num('tube', 'Thickness', 0.02, 0.05) : null, P.hole != null ? num('hole', 'Hole', 0.02) : null] },
        P.round != null ? { t: 'range', label: 'Corners', value: Math.round((s.round ?? 0.25) * 100), min: 1, max: 100, show: (v) => (v / 100).toFixed(2), on: (v) => re({ round: v / 100 }) } : null,
        P.points != null ? { t: 'row', items: [{ t: 'num', label: 'Points', value: s.points, min: 3, max: 24, on: (v) => re({ points: Math.max(3, Math.min(24, v | 0)) }) }, num('inner', 'Inner size', 0.1, 0.05)] } : null,
        P.sides != null ? { t: 'num', label: 'Sides', value: s.sides, min: 3, max: 24, on: (v) => re({ sides: Math.max(3, Math.min(24, v | 0)) }) } : null,
        P.form != null ? { t: 'seg', label: 'Form', buttons: Object.entries(E.STAGE_FORMS).map(([k, n]) => ({ label: n, pressed: (s.form || 'round') === k, on: () => re({ form: k }) })) } : null,
        P.form != null ? { t: 'range', label: 'Corners (sharp to round)', value: Math.round((s.corner ?? 0.3) * 100), min: 0, max: 100, show: (v) => v + '%', on: (v) => re({ corner: v / 100 }) } : null,
        P.form != null ? { t: 'range', label: 'Rounded rim', value: s.edge ?? 0.06, min: 0, max: 0.5, step: 0.01, on: (v) => re({ edge: v }) } : null,
        P.form != null ? { t: 'row', items: [{ t: 'num', label: 'Steps', value: s.steps || 1, min: 1, max: 6, on: (v) => re({ steps: Math.max(1, Math.min(6, v | 0)) }) }, { t: 'num', label: 'Each step in by', value: s.stepIn ?? 0.5, min: 0, step: 0.1, on: (v) => re({ stepIn: Math.max(0, v || 0) }) }] } : null,
        P.form != null ? { t: 'note', html: 'Height is the height of each step. Colour, pictures and patterns for the top, sides and bottom are under Material (Picture or gradient on). Stretch (below) distorts it.' } : null,
      ] });
    } else if (m.kind === 'text') {
      const t = m.text, re = (patch) => { Object.assign(t, patch); changed(m.id); };
      sections.push({ title: '3D text', items: [
        { t: 'area', label: 'Words', value: t.text, rows: 2, on: (v) => { re({ text: v || ' ' }); if (m.name === 'Text' || /^Text: /.test(m.name)) m.name = 'Text: ' + v.slice(0, 20); renderLayers(); } },
        { t: 'font3d', label: 'Font', value: t.font, on: (v) => { re({ font: v }); showProps(); } },
        { t: 'row', items: [{ t: 'check', label: 'Bold', value: !!t.bold, on: (v) => { re({ bold: v }); showProps(); } }, { t: 'select', label: 'Lines', value: t.align || 'center', options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], on: (v) => re({ align: v }) }] },
        { t: 'range', label: 'Letter size', value: t.size, min: 0.2, max: 6, step: 0.1, on: (v) => re({ size: v }) },
        { t: 'range', label: 'Depth', value: t.depth, min: 0.02, max: 3, step: 0.02, on: (v) => re({ depth: v }) },
        { t: 'range', label: 'Rounded edges (bevel)', value: t.bevel || 0, min: 0, max: 0.2, step: 0.005, on: (v) => re({ bevel: v }) },
        { t: 'range', label: 'Letter spacing (below 0 they touch)', value: t.spacing || 0, min: -150, max: 400, step: 5, on: (v) => re({ spacing: v }) },
        { t: 'range', label: 'Height (short and fat ↔ tall and thin)', value: Math.round((t.height || 1) * 100), min: 40, max: 250, step: 5, show: (v) => v + '%' + (v === 100 ? ' (normal)' : ''), on: (v) => re({ height: v / 100 }) },
        { t: 'btns', buttons: [{ label: 'Symbols and emoji…', on: () => CraftSymbols.open({ onPick: (r) => { t.text += r.char; if (r.kind === 'emoji') t.font = 'Noto Emoji'; else if (!(window.CRAFT_FONTS3D || []).some(([f]) => f === t.font && f.startsWith('Noto'))) t.font = 'Noto Sans Symbols 2'; changed(m.id); showProps(); } }) }] },
      ] });
      sections.push(lettersSection(m));
    } else if (m.kind === 'trace' && m.trace.cutout) {
      const tr = m.trace, re = (patch) => { Object.assign(tr, patch); changed(m.id); }, redo = (patch) => { Object.assign(tr, patch); photoCutout(tr.src, m); };
      sections.push({ title: 'Photo cut-out', items: [
        { t: 'range', label: 'Width', value: tr.width || 4, min: 0.5, max: 20, step: 0.1, on: (v) => re({ width: v }) },
        { t: 'range', label: 'Thickness', value: tr.depth || 0.15, min: 0.01, max: 3, step: 0.01, on: (v) => re({ depth: v }) },
        { t: 'range', label: 'Rounded edges (bevel)', value: tr.bevel || 0, min: 0, max: 0.1, step: 0.005, on: (v) => re({ bevel: v }) },
        { t: 'check', label: 'Remove a plain background', value: tr.removeBg !== false, on: (v) => redo({ removeBg: v }) },
        tr.removeBg !== false ? { t: 'range', label: 'Background tolerance', value: tr.tolerance ?? 40, min: 5, max: 160, step: 5, on: (v) => redo({ tolerance: v }) } : null,
        { t: 'range', label: 'Outline detail', value: tr.detail ?? 7, min: 1, max: 10, step: 1, on: (v) => redo({ detail: v }) },
        { t: 'note', html: 'The emboss is <b>Relief</b> under Material. The edges are the Sides face: give them any colour there.' },
        { t: 'btns', buttons: [{ label: 'Change the picture…', on: async () => { const s2 = await pickImage(); if (s2) { tr.src = s2; photoCutout(s2, m); } } }] },
      ] });
    } else if (m.kind === 'trace') {
      const tr = m.trace, re = (patch) => { Object.assign(tr, patch); changed(m.id); };
      sections.push({ title: 'Picture to 3D', items: [
        { t: 'note', html: `${tr.colors} colours traced. ${tr.paths || ''} outlines.` },
        { t: 'range', label: 'Width', value: tr.width || 4, min: 0.5, max: 20, step: 0.1, on: (v) => re({ width: v }) },
        { t: 'range', label: 'Depth', value: tr.depth || 0.4, min: 0.02, max: 3, step: 0.02, on: (v) => re({ depth: v }) },
        { t: 'range', label: 'Rounded edges (bevel)', value: tr.bevel || 0, min: 0, max: 0.1, step: 0.005, on: (v) => re({ bevel: v }) },
        { t: 'check', label: 'Stepped (each colour at a different height)', value: !!tr.stepped, on: (v) => re({ stepped: v }) },
        { t: 'btns', buttons: [{ label: 'Trace again…', on: () => openTrace(m) }] },
      ] });
    } else if (m.kind === 'model') {
      sections.push({ title: '3D model', items: [
        { t: 'note', html: `From a ${m.model.format.toUpperCase()} file, kept inside this scene.` },
        { t: 'range', label: 'Fit into', value: m.model.fit || 3, min: 0.2, max: 20, step: 0.1, on: (v) => { m.model.fit = v; changed(m.id); } },
        m.model.format === 'glb' || m.model.format === 'gltf' ? { t: 'check', label: "Use the model's own colours", value: m.model.keepOwn !== false, on: (v) => { m.model.keepOwn = v; changed(m.id); showProps(); } } : null,
      ] });
    } else if (m.kind === 'group') sections.push({ title: 'Group', items: [{ t: 'note', html: `${E.children(m.id).length} pieces. They move, turn and size together. Ungroup to change them one by one.` }, { t: 'btns', buttons: [{ label: 'Ungroup', on: ungroup }] }] });
    if (m.kind !== 'group' && (m.kind !== 'model' || m.model.keepOwn === false || m.model.format !== 'glb')) sections.push(materialSection(m));
    sections.push(transformSection(m));
    render(m.name || m.kind, sections);
  }
  function sceneProps() {
    const s = E.doc.scene, set = (patch) => { Object.assign(s, patch); E.applyScene(); changed(); showProps(); };
    render('Scene', [
      { title: 'Sky and backdrop', items: [{ t: 'note', html: 'The sky and the scenery behind the scene (layers of clouds, hills, a city…) are on the <b>Backdrop</b> tab.' }, { t: 'btns', buttons: [{ label: 'Backdrop tab', on: () => showTab('backdrop') }, { label: '🎲 New one', on: () => { showTab('backdrop'); window.BD3UI && BD3UI.newBackdrop(); } }] }] },
      { title: 'Ground', items: [{ t: 'note', html: 'The floor (none, shadow only, plain or a landscape), its colour and shadow strength are on the <b>Ground</b> tab.' }, { t: 'btns', buttons: [{ label: 'Ground tab', on: () => showTab('ground') }] }] },
      { title: 'Lights', items: [
        { t: 'seg', buttons: Object.entries(E.LIGHTS).map(([k, L]) => ({ label: L[0], pressed: s.light === k, on: () => set({ light: k }) })) },
        { t: 'range', label: 'Brightness', value: Math.round((s.lightPower ?? 1) * 100), min: 10, max: 250, show: (v) => v + '%', on: (v) => set({ lightPower: v / 100 }) },
        { t: 'range', label: 'Light comes from', value: s.lightAngle ?? 35, min: -180, max: 180, show: (v) => v + '°', on: (v) => set({ lightAngle: v }) },
        { t: 'range', label: 'Reflections', value: Math.round((s.reflect ?? 1) * 100), min: 0, max: 200, show: (v) => v + '%', on: (v) => set({ reflect: v / 100 }) },
      ] },
      { title: 'Camera', items: [
        { t: 'range', label: 'Lens (wide to zoom)', value: E.doc.camera.fov || 40, min: 15, max: 90, show: (v) => v + '°', on: (v) => { E.doc.camera.fov = v; E.mainView().cam.fov = v; E.redraw(); changed(); } },
        { t: 'btns', buttons: [{ label: 'See everything', on: () => E.fit() }, { label: 'Front', on: () => E.viewFrom('front') }, { label: 'Top', on: () => E.viewFrom('top') }, { label: '¾ view', on: () => E.viewFrom('three') }] },
      ] },
      { title: '', items: [{ t: 'note', html: 'Click something in the scene to change it. Drag in the view to look around (right-drag or Shift to slide, wheel to zoom). The dial in the corner turns the whole scene or the selected object.' }] },
    ]);
  }

  // ------------------------------------------------------------------ the corner dial
  const rc = $('rot-canvas'), rx = rc.getContext('2d');
  const AX = [['X', new T.Vector3(1, 0, 0), '#e03131'], ['Y', new T.Vector3(0, 1, 0), '#2f9e44'], ['Z', new T.Vector3(0, 0, 1), '#1c7ed6']];
  let rotHover = null, rotDrag = null;
  function ringPoints(axis, cam, R) {
    // a ring around a world axis, seen from the camera (an ellipse in the dial)
    const q = cam.quaternion.clone().invert(), u = new T.Vector3(), v = new T.Vector3();
    u.set(axis.y, axis.z, axis.x).cross(axis).normalize(); if (u.lengthSq() < 0.1) u.set(0, 0, 1).cross(axis).normalize(); v.crossVectors(axis, u).normalize();
    const pts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2, p = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).applyQuaternion(q); pts.push([66 + p.x * R, 66 - p.y * R, p.z]); }
    return pts;
  }
  function drawRotator() {
    const cam = E.cameraBasis(); if (!cam) return;
    rx.clearRect(0, 0, 132, 132);
    const q = cam.quaternion.clone().invert();
    // the centre ball
    const g = rx.createRadialGradient(58, 56, 4, 66, 66, 26); g.addColorStop(0, '#ffffff'); g.addColorStop(1, rotHover === 'ball' ? '#ffb27a' : '#c9ced6');
    rx.fillStyle = g; rx.beginPath(); rx.arc(66, 66, 24, 0, 7); rx.fill();
    AX.forEach(([n, axis, col]) => {
      const pts = ringPoints(axis, cam, 50);
      rx.lineWidth = rotHover === n ? 5 : 3; rx.strokeStyle = col; rx.globalAlpha = rotHover && rotHover !== n ? 0.45 : 0.95;
      rx.beginPath(); pts.forEach(([x, y], i) => (i ? rx.lineTo(x, y) : rx.moveTo(x, y))); rx.stroke();
      // the axis end with its letter
      const e = axis.clone().applyQuaternion(q); rx.globalAlpha = e.z < -0.2 ? 0.5 : 1;
      rx.fillStyle = col; rx.beginPath(); rx.arc(66 + e.x * 58, 66 - e.y * 58, 8, 0, 7); rx.fill();
      rx.fillStyle = '#fff'; rx.font = 'bold 10px system-ui,sans-serif'; rx.textAlign = 'center'; rx.textBaseline = 'middle'; rx.fillText(n, 66 + e.x * 58, 66 - e.y * 58 + 0.5);
    });
    rx.globalAlpha = 1;
    document.querySelectorAll('[data-rt]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rt === E.rotateTarget)));
  }
  const dialPos = (e) => { const r = rc.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 132, ((e.clientY - r.top) / r.height) * 132]; };
  function dialHit([x, y]) {
    const cam = E.cameraBasis(); if (!cam) return null;
    if (Math.hypot(x - 66, y - 66) < 24) return 'ball';
    let best = null, bd = 7;
    AX.forEach(([n, axis]) => { ringPoints(axis, cam, 50).forEach(([px, py]) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = n; } }); const e = axis.clone().applyQuaternion(cam.quaternion.clone().invert()); if (Math.hypot(66 + e.x * 58 - x, 66 - e.y * 58 - y) < 9) best = 'end' + n; });
    return best;
  }
  rc.addEventListener('pointermove', (e) => {
    const p = dialPos(e);
    if (!rotDrag) { const h = dialHit(p); const hv = h && h.startsWith('end') ? h.slice(3) : h; if (hv !== rotHover) { rotHover = hv; drawRotator(); } return; }
    const cam = E.cameraBasis();
    if (rotDrag.what === 'ball') { // free turn: drag right turns around the view's up, drag down around its right
      const dx = p[0] - rotDrag.last[0], dy = p[1] - rotDrag.last[1];
      const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), right = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      if (dx) E.rotateBy(up, dx * 0.02); if (dy) E.rotateBy(right, dy * 0.02);
    } else { // ring: turn by the angle swept around the dial's centre
      const a0 = Math.atan2(rotDrag.last[1] - 66, rotDrag.last[0] - 66), a1 = Math.atan2(p[1] - 66, p[0] - 66);
      let da = a1 - a0; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      const axis = AX.find(([n]) => n === rotDrag.what)[1], facing = axis.clone().applyQuaternion(cam.quaternion.clone().invert()).z;
      E.rotateBy(axis, -da * (facing >= 0 ? 1 : -1) * (e.shiftKey ? 0.25 : 1));
    }
    rotDrag.last = p; drawRotator();
  });
  rc.addEventListener('pointerdown', (e) => {
    const h = dialHit(dialPos(e)); if (!h) return;
    if (h.startsWith('end')) { // click an axis end: look along it (whole scene), or line the object up with it (selected)
      const n = h.slice(3);
      if (E.rotateTarget === 'all') E.viewFrom({ X: 'right', Y: 'top', Z: 'front' }[n]);
      else { const m = sel(); if (m) { m.rot = m.rot.map((v, i) => ('XYZ'[i] === n ? 0 : v)); E.placeOne(m.id); changed(); showProps(); } }
      return;
    }
    rc.setPointerCapture(e.pointerId); rotDrag = { what: h, last: dialPos(e) };
  });
  rc.addEventListener('pointerup', () => { if (rotDrag) { rotDrag = null; E.rotateDone(); } });
  rc.addEventListener('dblclick', (e) => { if (dialHit(dialPos(e)) !== 'ball') return; if (E.rotateTarget === 'selected' && sel()) { sel().rot = [0, 0, 0]; E.placeOne(sel().id); changed(); showProps(); } else { E.viewFrom('three'); E.fit(); } });
  rc.addEventListener('pointerleave', () => { if (!rotDrag) { rotHover = null; drawRotator(); } });
  document.querySelectorAll('[data-rt]').forEach((b) => { b.onclick = () => { if (b.dataset.rt === 'selected' && !sel()) toast('Click an object first, then the dial turns just that object.'); E.rotateTarget = b.dataset.rt; drawRotator(); tb && tb.update(); }; });

  // ------------------------------------------------------------------ Picture to 3D
  let traceSrc = null, traceResult = null, traceEdit = null, traceMode = 'auto';
  async function openTrace(edit, src) {
    if (!E.doc) return;
    traceEdit = edit || null;
    if (src) { traceSrc = await shrinkImage(src); $('tracedlg').hidden = false; syncTraceUi(); runTrace(); return; }
    if (edit) { traceSrc = edit.trace.src; traceMode = edit.trace.mode || 'auto'; $('tr-n').value = edit.trace.colors; $('tr-detail').value = edit.trace.detail || 6; $('tr-smooth').value = edit.trace.smooth ?? 1; $('tr-bg').checked = edit.trace.removeBg !== false; $('tr-depth').value = edit.trace.depth || 0.4; $('tr-step').checked = !!edit.trace.stepped; $('tr-own').checked = edit.trace.ownColours !== false; }
    else { traceSrc = await pickImage(); if (!traceSrc) return; }
    $('tracedlg').hidden = false; syncTraceUi(); runTrace();
  }
  const pickImage = () => new Promise((res) => { const i = $('image-input'); i.value = ''; i.onchange = () => { const f = i.files[0]; if (!f) return res(null); const r = new FileReader(); r.onload = () => shrinkImage(r.result).then(res); r.readAsDataURL(f); }; i.click(); });
  // pictures are kept in the scene at a sensible size (the tracer never needs more than 1000 pixels)
  const shrinkImage = (src) => new Promise((res) => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight)); if (k >= 1) return res(src); const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = () => res(src); im.src = src; });
  function syncTraceUi() {
    document.querySelectorAll('#tr-mode [data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === traceMode)));
    $('tr-n-f').hidden = traceMode !== 'n';
    ['n', 'detail', 'smooth', 'depth'].forEach((k) => { $(`tr-${k}-v`).textContent = $(`tr-${k}`).value; });
    $('trace-src').innerHTML = `<img src="${traceSrc}" alt="Your picture">`;
  }
  let traceT = null;
  async function runTrace() {
    clearTimeout(traceT);
    traceT = setTimeout(async () => {
      $('trace-info').textContent = 'Tracing…';
      try {
        traceResult = await CraftTracer.trace(traceSrc, { colors: traceMode === 'auto' ? 'auto' : +$('tr-n').value, detail: +$('tr-detail').value, smooth: +$('tr-smooth').value, removeBg: $('tr-bg').checked });
        $('trace-out').innerHTML = traceResult.svg;
        $('trace-info').textContent = `${traceResult.colors} colours${traceMode === 'auto' ? ' (best match)' : ''}, ${traceResult.paths} outlines`;
        if (traceMode === 'auto') { $('tr-n').value = traceResult.colors; $('tr-n-v').textContent = traceResult.colors; }
      } catch (e) { $('trace-info').textContent = e.message; }
    }, 200);
  }
  document.querySelectorAll('#tr-mode [data-m]').forEach((b) => { b.onclick = () => { traceMode = b.dataset.m; syncTraceUi(); runTrace(); }; });
  ['tr-n', 'tr-detail', 'tr-smooth', 'tr-bg'].forEach((id) => { $(id).addEventListener('input', () => { syncTraceUi(); runTrace(); }); $(id).addEventListener('change', () => { syncTraceUi(); runTrace(); }); });
  ['tr-depth'].forEach((id) => $(id).addEventListener('input', syncTraceUi));
  $('tr-pick').onclick = async () => { const s = await pickImage(); if (s) { traceSrc = s; syncTraceUi(); runTrace(); } };
  $('tr-cancel').onclick = () => { $('tracedlg').hidden = true; };
  $('tr-go').onclick = () => {
    if (!traceResult || !traceResult.paths) return toast('Nothing was traced yet: try more colours or turn off "Leave out the background".');
    const tr = { src: traceSrc, svg: traceResult.svg, colors: traceResult.colors, paths: traceResult.paths, mode: traceMode, detail: +$('tr-detail').value, smooth: +$('tr-smooth').value, removeBg: $('tr-bg').checked,
      depth: +$('tr-depth').value, stepped: $('tr-step').checked, ownColours: $('tr-own').checked, width: traceEdit ? traceEdit.trace.width : 4, bevel: traceEdit ? traceEdit.trace.bevel : 0 };
    $('tracedlg').hidden = true;
    if (traceEdit) { traceEdit.trace = tr; changed(traceEdit.id); showProps(); return; }
    const w = traceResult.width, h = traceResult.height, m = { kind: 'trace', name: 'Picture in 3D', trace: tr, mat: E.defaultMat('#888888', 'plastic') };
    m.rot = [0, 0, 0]; standOnGround(m, (4 * h) / w);
    addObject(m);
  };


  // ------------------------------------------------------------------ photo cut-out
  // A picture cut out round its shape (its see-through parts, or a plain background taken from the corners), pulled out
  // into a solid with the photo itself on the front and back. Kept as a 'trace' object with trace.cutout set.
  function cutoutImages(src, o) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)), W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H), D = d.data, at = (u, v) => (v * W + u) * 4, corners = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
        const cornerAlpha = corners.reduce((s, i) => s + D[i + 3], 0) / 4, bg = [0, 1, 2].map((q) => corners.reduce((s, i) => s + D[i + q], 0) / 4), tol = o.tolerance ?? 40;
        // see-through where the picture already is, or where it matches the background colour
        if (o.removeBg !== false && cornerAlpha > 200) for (let i = 0; i < D.length; i += 4) { const dist = Math.hypot(D[i] - bg[0], D[i + 1] - bg[1], D[i + 2] - bg[2]); if (dist < tol) D[i + 3] = 0; else if (dist < tol + 25) D[i + 3] = Math.min(D[i + 3], ((dist - tol) / 25) * 255); }
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) if (D[at(u, v) + 3] > 128) { if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
        if (x1 < 0) return rej(new Error('Nothing was left after taking out the background: lower the tolerance or turn Remove background off.'));
        x.putImageData(d, 0, 0);
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1, pic = document.createElement('canvas'); pic.width = cw; pic.height = ch; pic.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
        // the shape alone: black on white, for tracing
        const mask = document.createElement('canvas'); mask.width = cw + 4; mask.height = ch + 4; const mx = mask.getContext('2d'); mx.fillStyle = '#ffffff'; mx.fillRect(0, 0, cw + 4, ch + 4);
        const md = mx.getImageData(0, 0, cw + 4, ch + 4), MD = md.data, PD = pic.getContext('2d').getImageData(0, 0, cw, ch).data;
        for (let v = 0; v < ch; v++) for (let u = 0; u < cw; u++) if (PD[(v * cw + u) * 4 + 3] > 128) { const o2 = ((v + 2) * (cw + 4) + (u + 2)) * 4; MD[o2] = MD[o2 + 1] = MD[o2 + 2] = 0; }
        mx.putImageData(md, 0, 0);
        res({ pic: pic.toDataURL('image/png'), mask: mask.toDataURL('image/png'), w: cw, h: ch });
      };
      img.onerror = () => rej(new Error('That picture could not be read.'));
      img.src = src;
    });
  }
  async function makeCutout(src, o, edit) {
    const im = await cutoutImages(src, o);
    const t = await CraftTracer.trace(im.mask, { colors: 2, detail: o.detail ?? 7, smooth: 2, removeBg: true });
    if (!t || !t.svg || !/<path/.test(t.svg)) throw new Error('No outline was found in that picture.');
    const photo = { type: 'picture', src: im.pic, fit: 'stretch', opacity: 1, size: 20 };
    const tr = { src, svg: t.svg, colors: 1, paths: (t.svg.match(/<path/g) || []).length, mode: 'cutout', cutout: true, removeBg: o.removeBg !== false, tolerance: o.tolerance ?? 40, detail: o.detail ?? 7,
      depth: edit ? edit.trace.depth : 0.15, width: edit ? edit.trace.width : 4, bevel: edit ? edit.trace.bevel : 0.015, stepped: false, ownColours: false, aspect: im.w / im.h };
    if (edit) { edit.trace = tr; edit.mat.faces = { ...(edit.mat.faces || {}), front: photo, back: photo }; changed(edit.id); showProps(); return edit; }
    const m = { kind: 'trace', name: 'Photo cut-out', trace: tr, mat: { ...E.defaultMat('#f4f1ea', 'matte'), relief: 0.6, faces: { front: photo, back: photo } } };
    m.rot = [0, 0, 0]; standOnGround(m, (4 * im.h) / im.w);
    return addObject(m);
  }
  async function photoCutout(src, edit) {
    if (!E.doc) return;
    if (!src) src = await pickImage(); if (!src) return;
    toast('Cutting out the picture…');
    try { return await makeCutout(src, edit ? edit.trace : {}, edit); } catch (e) { info('Photo cut-out', esc(e.message)); }
  }

  // Drop a picture on the view to make it 3D, or a GLB, OBJ or STL file to bring the model in
  $('desk').addEventListener('dragover', (e) => { if ([...(e.dataTransfer.items || [])].some((i) => i.kind === 'file')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  $('desk').addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f || !E.doc) return; e.preventDefault();
    if (/\.(glb|gltf|obj|stl)$/i.test(f.name)) importModel(f);
    else if (/^image\//.test(f.type)) { const r = new FileReader(); r.onload = () => openTrace(null, r.result); r.readAsDataURL(f); }
    else toast('Drop a picture (to make it 3D) or a GLB, OBJ or STL model.');
  });

  // ------------------------------------------------------------------ export
  const SIZES = [[1280, 720, '1280 × 720 (HD, web)'], [1920, 1080, '1920 × 1080 (Full HD)'], [3840, 2160, '3840 × 2160 (4K)'], [1080, 1080, '1080 × 1080 (square)'], [2048, 2048, '2048 × 2048 (square, large)'], [2400, 3000, '2400 × 3000 (print, 8 × 10 in at 300 DPI)'], [3300, 2550, '3300 × 2550 (print, 11 × 8.5 in at 300 DPI)']];
  $('ex-size').innerHTML = SIZES.map(([w, h, n], i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${n}</option>`).join('');
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const baseName = () => (E.doc && E.doc.name || 'scene').replace(/[^\w -]+/g, '').trim() || 'scene';
  const openExport = () => { if (!E.doc) return; $('ex-note').textContent = ''; $('exportdlg').hidden = false; };
  $('ex-close').onclick = () => { $('exportdlg').hidden = true; };
  $('ex-pic').onclick = () => {
    const [w, h] = SIZES[+$('ex-size').value], fmt = $('ex-fmt').value, transparent = $('ex-transp').checked && fmt === 'png';
    $('ex-note').textContent = 'Drawing the picture…';
    setTimeout(() => {
      try { const c = E.renderImage(w, h, { transparent }); c.toBlob((b) => { download(b, `${baseName()}.${fmt}`); $('ex-note').textContent = `Saved ${w} × ${h} ${fmt.toUpperCase()}.`; }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.93); }
      catch (e) { $('ex-note').textContent = 'Sorry, that did not work: ' + e.message; }
    }, 30);
  };
  document.querySelectorAll('[data-x3]').forEach((b) => { b.onclick = async () => { try { $('ex-note').textContent = 'Saving…'; const blob = await E.exportModel(b.dataset.x3, $('ex-only').checked); download(blob, `${baseName()}.${b.dataset.x3}`); $('ex-note').textContent = `Saved ${baseName()}.${b.dataset.x3}.`; } catch (e) { $('ex-note').textContent = 'Sorry, that did not work: ' + e.message; } }; });

  // ------------------------------------------------------------------ Render (ray-traced)
  const RSIZES = [[640, 360, 'Quick look 640 × 360'], [1280, 720, '1280 × 720 (HD)'], [1920, 1080, '1920 × 1080 (Full HD)'], [3840, 2160, '3840 × 2160 (4K)'], [1080, 1080, '1080 × 1080 (square)'], [2048, 2048, '2048 × 2048 (square, large)'], [2400, 3000, '2400 × 3000 (print, 8 × 10 in)'], [3300, 2550, '3300 × 2550 (print, 11 × 8.5 in)']];
  const QTIP = { draft: 'A quick look: a little grainy. Seconds.', good: 'Clean enough for the web. Under a minute for most scenes.', high: 'Smooth glass and soft shadows. A few minutes at large sizes.', best: 'As clean as it gets, for print. Can take a while: you can stop it any time and keep what it has.' };
  let rdQ = 'good', rdJob = null, rdOut = null;
  $('rd-size').innerHTML = RSIZES.map(([w, h, n], i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${n}</option>`).join('');
  const rdSync = () => { $('rd-q').innerHTML = Object.entries(E.QUALITY).map(([k, q]) => `<button class="btn" data-q="${k}" aria-pressed="${k === rdQ}" title="${q[1]} samples, ${q[2]} light bounces">${q[0]}</button>`).join(''); $('rd-q-tip').textContent = `${E.QUALITY[rdQ][1]} samples. ${QTIP[rdQ]}`; };
  $('rd-q').onclick = (e) => { const b = e.target.closest('[data-q]'); if (b && !rdJob) { rdQ = b.dataset.q; rdSync(); } };
  const openRender = () => { if (!E.doc) return; rdSync(); $('renderdlg').hidden = false; };
  const rdBusy = (on) => { $('rd-go').disabled = on; $('rd-stop').disabled = !on; $('rd-close').disabled = on; ['rd-size', 'rd-transp', 'rd-aa'].forEach((id) => { $(id).disabled = on; }); };
  $('rd-go').onclick = () => {
    const [w, h] = RSIZES[+$('rd-size').value], t0 = performance.now();
    $('rd-view').innerHTML = ''; $('rd-view').style.aspectRatio = `${w} / ${h}`; rdBusy(true); $('rd-png').disabled = $('rd-jpg').disabled = true;
    $('rd-status').textContent = 'Getting the scene ready… (a very detailed scene can take a few seconds)'; $('rd-bar').style.width = '0';
    const show = (c) => { if (!$('rd-view').contains(c)) { $('rd-view').innerHTML = ''; $('rd-view').append(c); } };
    if (rdSmoother) rdSmoother.dispose(); rdRaw = rdSmoother = null;
    // let the message show before the heavy preparing starts (it holds the window for a moment)
    let cancelled = false; rdJob = { stop: () => { cancelled = true; rdJob = null; rdBusy(false); $('rd-status').textContent = 'Stopped.'; } };
    setTimeout(() => requestAnimationFrame(() => { if (cancelled) return; startRender(); }), 30);
    const startRender = () => { rdJob = E.pathRender(w, h, { quality: rdQ, transparent: $('rd-transp').checked, edges: +$('rd-aa').value || 1,
      onProgress: (c, n, of) => { show(c); $('rd-bar').style.width = Math.round((n / of) * 100) + '%'; $('rd-status').textContent = `${n} of ${of} samples · ${Math.round((performance.now() - t0) / 1000)} s`; },
      onDone: (c, n, early, smoother) => { rdRaw = c; rdSmoother = smoother; rdOut = rdPick(); show(rdOut); rdJob = null; rdBusy(false); $('rd-png').disabled = $('rd-jpg').disabled = false; $('rd-bar').style.width = early ? $('rd-bar').style.width : '100%';
        const aa = rdJob0 && rdJob0.edges > 1 ? `, edges ${rdJob0.edges}× smoother` : '', capped = rdJob0 && +$('rd-aa').value > Math.max(1, rdJob0.edges) ? ' (as smooth as fits at this size)' : '';
        $('rd-status').textContent = `${early ? 'Stopped at' : 'Done:'} ${n} samples, ${w} × ${h}${aa}${capped}, in ${Math.round((performance.now() - t0) / 1000)} s.`; } });
    rdJob0 = rdJob; };
    let rdJob0 = null;
  };
  $('rd-stop').onclick = () => { if (rdJob) rdJob.stop(); };
  // switch between the smoothed and the raw picture after rendering, to compare (what shows is what is saved)
  let rdRaw = null, rdSmoother = null;
  const rdPick = () => { let c = null; try { c = rdSmoother && rdSmoother.make($('rd-dn').value); } catch (e) { console.warn(e); } return c || rdRaw; };
  $('rd-dn').onchange = () => { if (rdJob || !rdRaw) return; rdOut = rdPick(); $('rd-view').innerHTML = ''; $('rd-view').append(rdOut); };
  $('rd-close').onclick = () => { if (!rdJob) $('renderdlg').hidden = true; };
  // the smoothing's helper pictures stay on the graphics card until the window closes (so the level can be changed)
  new MutationObserver(() => { if ($('renderdlg').hidden && rdSmoother) { rdSmoother.dispose(); rdSmoother = null; } }).observe($('renderdlg'), { attributes: true, attributeFilter: ['hidden'] });
  const rdSave = (fmt) => { if (!rdOut) return; let c = rdOut; if (fmt === 'jpg') { c = document.createElement('canvas'); c.width = rdOut.width; c.height = rdOut.height; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(rdOut, 0, 0); } c.toBlob((b) => download(b, `${baseName()}-render.${fmt}`), fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95); };
  $('rd-png').onclick = () => rdSave('png'); $('rd-jpg').onclick = () => rdSave('jpg');
  $('renderdlg').addEventListener('keydown', (e) => { if (e.key === 'Escape' && !rdJob) $('renderdlg').hidden = true; });

  // ------------------------------------------------------------------ files
  async function openDoc(d) {
    if (!d || d.app !== '3DCraft' || !Array.isArray(d.objects)) throw new Error('This is not a 3DCraft scene.');
    E.doc = d; E.time = 0; E.applyCamera(); await E.rebuild(); resetHistory(); fileName = null; if (window.TL3) TL3.render();
    $('start').hidden = true; renderLayers(); showProps(); status(); tb && tb.update();
  }
  $('open-input').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await openDoc(JSON.parse(await f.text())); fileName = f.name; } catch (err) { info('Could not open that file', esc(err.message)); } };
  async function save(as) {
    if (!E.doc) return;
    E.saveCamera();
    const text = JSON.stringify(E.doc), blob = new Blob([text], { type: 'application/json' });
    let name = !as && fileName ? fileName : (E.doc.name || 'My scene') + '.3dcraft.json';
    if (as || !fileName) { const n = prompt('Save as', name.replace(/\.3dcraft\.json$/, '')); if (n === null) return; name = n.replace(/\.3dcraft\.json$|\.json$/i, '') + '.3dcraft.json'; E.doc.name = name.replace(/\.3dcraft\.json$/, ''); }
    download(blob, name); fileName = name; dirty = false; toast('Saved. Look in your Downloads folder.'); tb && tb.update(); status();
  }

  // ------------------------------------------------------------------ start screen and starter scenes
  const STARTERS = {
    blank: ['Empty scene', 'Start from nothing', '<rect x="12" y="14" width="50" height="40" rx="3" fill="#fff" stroke="#9aa1ad" stroke-width="2" stroke-dasharray="4 3"/><path d="M14 54l20-12 26 12" fill="none" stroke="#c5ccd6" stroke-width="2"/>'],
    title: ['3D title', 'Gold letters standing on a floor', '<rect x="4" y="10" width="66" height="52" rx="4" fill="#dfe7f2"/><text x="37" y="42" text-anchor="middle" font-family="Archivo Black, Impact, sans-serif" font-size="18" fill="#b8860b" stroke="#7a5a08" stroke-width="1">3D</text><ellipse cx="37" cy="52" rx="24" ry="4" fill="#0002"/>'],
    chrome: ['Retro chrome', 'Shiny 80s letters on a night sky', '<defs><linearGradient id="st-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1035"/><stop offset="1" stop-color="#7a2a8f"/></linearGradient><linearGradient id="st-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#7f8fa6"/><stop offset=".55" stop-color="#2c3e50"/><stop offset="1" stop-color="#dfe6ee"/></linearGradient></defs><rect x="4" y="10" width="66" height="52" rx="4" fill="url(#st-c)"/><text x="37" y="44" text-anchor="middle" font-family="Orbitron, sans-serif" font-size="16" font-weight="bold" fill="url(#st-m)">RAD</text>'],
    still: ['Shapes still life', 'A few shapes in a soft studio light', '<rect x="4" y="10" width="66" height="52" rx="4" fill="#eef1f5"/><circle cx="26" cy="40" r="10" fill="#e8590c"/><path d="M40 50l8-18 8 18z" fill="#3f7fe0"/><rect x="48" y="38" width="12" height="12" fill="#2f9e44"/>'],
    test: ['Test scene', 'Everything at once: moving letters, materials, moves and a camera move', '<rect x="4" y="10" width="66" height="52" rx="4" fill="#e9edf3"/><text x="37" y="30" text-anchor="middle" font-family="Archivo Black, Impact, sans-serif" font-size="13" fill="#e6b422" transform="rotate(-6 37 30)">TEST</text><circle cx="17" cy="48" r="6" fill="#cfe8ff" stroke="#9fc3e0"/><rect x="28" y="42" width="11" height="11" fill="#e03131"/><path d="M44 53l6-12 6 12z" fill="#2f9e44"/><circle cx="62" cy="48" r="5" fill="none" stroke="#adb5bd" stroke-width="3"/>'],
    ball: ['Bouncing ball demo', 'A retro checkered ball bouncing and spinning in front of a grid', '<rect x="4" y="10" width="66" height="52" rx="4" fill="#244444"/><path d="M14 18h46M14 28h46M14 38h46M14 48h46M20 14v44M32 14v44M44 14v44M56 14v44" stroke="#3fe0b8" stroke-width="1.2"/><circle cx="37" cy="32" r="13" fill="#fff"/><path d="M27 24l7 0 0 7-7 0zM41 24l7 0 0 7-7 0zM34 31l7 0 0 7-7 0zM27 38l7 0 0 5-7 0zM41 38l7 0 0 5-7 0z" fill="#e8102e"/>'],
    glass: ['Glass and gold', 'A glass ball and a gold ring', '<rect x="4" y="10" width="66" height="52" rx="4" fill="#f4efe6"/><circle cx="28" cy="38" r="12" fill="#cfe8ff" stroke="#9fc3e0" stroke-width="2" opacity=".8"/><ellipse cx="50" cy="44" rx="11" ry="6" fill="none" stroke="#e6b422" stroke-width="4"/>'],
  };
  $('kinds').innerHTML = Object.entries(STARTERS).map(([k, s]) => `<button class="kind" data-kind="${k}"><svg viewBox="0 0 74 74">${s[2]}</svg><b>${s[0]}</b><small>${s[1]}</small></button>`).join('');
  $('kinds').onclick = (e) => { const b = e.target.closest('[data-kind]'); if (b) startScene(b.dataset.kind); };
  function showStart() { $('start').hidden = false; $('start-resume').hidden = !E.doc && !localStorage.getItem(AUTOSAVE); }
  $('start-open').onclick = () => $('open-input').click();
  $('start-resume').onclick = async () => { if (!E.doc) { try { await openDoc(JSON.parse(localStorage.getItem(AUTOSAVE))); } catch (e) { toast('The last scene could not be opened.'); return; } } $('start').hidden = true; };
  async function startScene(kind) {
    const d = E.newDoc({ name: STARTERS[kind][0] === 'Empty scene' ? 'My scene' : STARTERS[kind][0] });
    const obj = (m) => { const o = { id: E.uid(), parent: null, visible: true, locked: false, rot: [0, 0, 0], scale: [1, 1, 1], ...m }; d.objects.push(o); return o; };
    // The retro bouncing ball: a high-resolution checkerboard (16 by 8 squares) on a smooth ball that bounces across and
    // back (a falling curve each bounce), squashes a little as it lands, and spins on a tilted axis.
    const bouncingBall = ({ L, R, x0, x1, z, up }) => {
      const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const cx = cv.getContext('2d');
      for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) { cx.fillStyle = (i + j) % 2 ? '#ffffff' : '#e8102e'; cx.fillRect(i * 128, j * 128, 128, 128); }
      const keys = { pos: [], rot: [], scale: [] }, steps = Math.round(L * 15);
      for (let f = 0; f <= steps; f++) {
        const t = (f / steps) * L, u = t % 1, x = t < L / 2 ? x0 + ((x1 - x0) * t) / (L / 2) : x1 - ((x1 - x0) * (t - L / 2)) / (L / 2);
        keys.pos.push({ t: +t.toFixed(4), v: [x, R + up * (1 - (2 * u - 1) ** 2), z], ease: 'linear' });
      }
      for (let b = 0; b <= L; b++) keys.scale.push({ t: Math.max(0, b - 0.08), v: [1, 1, 1], ease: 'ease' }, { t: b, v: [1.14, 0.84, 1.14], ease: 'ease' }, { t: Math.min(L, b + 0.1), v: [1, 1, 1], ease: 'ease' });
      keys.scale = keys.scale.filter((k, i, a) => a.findIndex((q) => Math.abs(q.t - k.t) < 1e-3) === i).sort((a, b) => a.t - b.t);
      keys.rot = [{ t: 0, v: [18, 0, 0], ease: 'linear' }, { t: L, v: [18, -180 * L, 0], ease: 'linear' }];
      const ball = obj({ kind: 'shape', name: 'Checkered ball', shape: { type: 'sphere', r: R }, mat: { ...E.defaultMat('#ffffff', 'gloss'), faces: { all: { type: 'picture', src: cv.toDataURL('image/png'), fit: 'stretch', opacity: 1, size: 20 } } }, pos: [x0, R, z] });
      return { ball, keys };
    };
    const text = (t, font, mat, pos, o = {}) => obj({ kind: 'text', name: 'Text: ' + t, text: { text: t, font, bold: false, size: o.size || 1.4, depth: o.depth || 0.45, bevel: o.bevel ?? 0.04, spacing: o.spacing || 0, align: 'center', lead: 1.1 }, mat, pos });
    if (kind === 'title') { text('3D CRAFT', 'Archivo Black', E.defaultMat('#e6b422', 'gold'), [0, 0.75, 0]); d.camera = { pos: [3.5, 2.6, 7.5], target: [0, 0.8, 0], fov: 40 }; }
    if (kind === 'chrome') {
      Object.assign(d.scene, { bg: { type: 'gradient', c1: '#1b1035', c2: '#7a2a8f', angle: 0 }, light: 'night', lightPower: 1.6, groundStyle: 'floor', groundColor: '#140b2a', shadow: 0.5, reflect: 1.6 });
      text('RADICAL', 'Orbitron', E.defaultMat('#ffffff', 'chrome'), [0, 0.8, 0], { size: 1.3, depth: 0.5, bevel: 0.05 });
      obj({ kind: 'shape', name: 'Glow bar', shape: { type: 'box', w: 6.5, h: 0.08, d: 0.08 }, mat: { ...E.defaultMat('#ff4fd8', 'glow') }, pos: [0, 0.05, 0.4] });
      d.camera = { pos: [0, 1.8, 8], target: [0, 0.8, 0], fov: 38 };
    }
    if (kind === 'still') {
      obj({ kind: 'shape', name: 'Sphere', shape: { type: 'sphere', r: 0.9 }, mat: E.defaultMat('#e8590c', 'gloss'), pos: [-1.8, 0.9, 0.3] });
      obj({ kind: 'shape', name: 'Pyramid', shape: { type: 'pyramid', r: 1.1, h: 1.8 }, mat: E.defaultMat('#3f7fe0', 'plastic'), pos: [0.2, 0.9, -0.6] });
      obj({ kind: 'shape', name: 'Rounded box', shape: { type: 'roundbox', w: 1.4, h: 1.4, d: 1.4, round: 0.2 }, mat: E.defaultMat('#2f9e44', 'matte'), pos: [2, 0.7, 0.4], rot: [0, 25, 0] });
      obj({ kind: 'shape', name: 'Doughnut', shape: { type: 'torus', r: 0.6, tube: 0.22 }, mat: E.defaultMat('#c2255c', 'gloss'), pos: [0.3, 0.22, 1.5], rot: [90, 0, 0] });
      Object.assign(d.scene, { light: 'soft', bg: { type: 'gradient', c1: '#f4f6f9', c2: '#d6dde6', angle: 0 }, groundColor: '#eef1f5' });
      d.camera = { pos: [4.5, 3.6, 7], target: [0, 0.7, 0], fov: 38 };
    }
    if (kind === 'glass') {
      obj({ kind: 'shape', name: 'Glass ball', shape: { type: 'sphere', r: 1 }, mat: E.defaultMat('#ffffff', 'glass'), pos: [-0.9, 1, 0] });
      obj({ kind: 'shape', name: 'Gold ring', shape: { type: 'torus', r: 0.8, tube: 0.18 }, mat: E.defaultMat('#e6b422', 'gold'), pos: [1.3, 0.18, 0.6], rot: [90, 0, 0] });
      obj({ kind: 'shape', name: 'Stand', shape: { type: 'cylinder', r: 2.6, h: 0.1 }, mat: E.defaultMat('#f4efe6', 'matte'), pos: [0, 0.05, 0] });
      Object.assign(d.scene, { light: 'studio', bg: { type: 'gradient', c1: '#fbf7f0', c2: '#e2d6c2', angle: 0 }, groundColor: '#efe7da', reflect: 1.3 });
      d.camera = { pos: [3.2, 2.8, 5.6], target: [0.1, 0.6, 0], fov: 38 };
    }
    // A scene for trying everything: letters that spin in and wave, every kind of material, ready-made moves and a camera move
    if (kind === 'test') {
      const L = 6, tracks = {}, keys = (o, k) => { tracks[o.id] = { ...(tracks[o.id] || {}), keys: { ...((tracks[o.id] || {}).keys || {}), ...k } }; };
      const K = (list) => list.map(([t, v, ease]) => ({ t, v, ease: ease || 'ease' }));
      const title = text('3DCRAFT TEST', 'Archivo Black', E.defaultMat('#e6b422', 'gold'), [0, 2.9, -1.2], { size: 1.1, depth: 0.4, bevel: 0.035 });
      tracks[title.id] = { keys: {}, letters: { style: 'spin', mode: 'both', start: 0.2, leave: 4.1, each: 0.7, gap: 0.09, order: 'left', amount: 1, speed: 2 } };
      const wave = text('letters wave', 'Pacifico', E.defaultMat('#7048e8', 'gloss'), [0, 1.55, -1.2], { size: 0.75, depth: 0.25, bevel: 0.02 });
      tracks[wave.id] = { keys: {}, letters: { style: 'wave', mode: 'in', start: 0, leave: 5, each: 0.5, gap: 0.12, order: 'left', amount: 1, speed: 1.6 } };
      const glass = obj({ kind: 'shape', name: 'Glass ball', shape: { type: 'sphere', r: 0.6 }, mat: E.defaultMat('#ffffff', 'glass'), pos: [-4.2, 0.6, 1.4] });
      keys(glass, { pos: K([[0, [-4.2, 0.6, 1.4], 'out'], [0.75, [-4.2, 1.9, 1.4], 'in'], [1.5, [-4.2, 0.6, 1.4], 'out'], [2.25, [-4.2, 1.9, 1.4], 'in'], [3, [-4.2, 0.6, 1.4], 'out'], [3.75, [-4.2, 1.9, 1.4], 'in'], [4.5, [-4.2, 0.6, 1.4], 'out'], [5.25, [-4.2, 1.9, 1.4], 'in'], [6, [-4.2, 0.6, 1.4]]]) });
      const chrome = obj({ kind: 'shape', name: 'Chrome ring', shape: { type: 'torus', r: 0.55, tube: 0.18 }, mat: E.defaultMat('#ffffff', 'chrome'), pos: [-2.5, 0.75, 1.4] });
      keys(chrome, { rot: K([[0, [0, 0, 0], 'linear'], [L, [0, 360, 0]]]) });
      const box = obj({ kind: 'shape', name: 'Red box (gradient front)', shape: { type: 'roundbox', w: 1, h: 1, d: 1, round: 0.12 }, mat: { ...E.defaultMat('#e03131', 'plastic'), faces: { front: { type: 'gradient', c1: '#ffd43b', c2: '#e03131', angle: 90 } } }, pos: [-0.8, 0.5, 1.5] });
      keys(box, { rot: K([[0, [0, 0, 0], 'ease'], [1.5, [0, 0, 12], 'ease'], [3, [0, 0, 0], 'ease'], [4.5, [0, 0, -12], 'ease'], [6, [0, 0, 0]]]) });
      const pyr = obj({ kind: 'shape', name: 'Green pyramid', shape: { type: 'pyramid', r: 0.7, h: 1.2 }, mat: E.defaultMat('#2f9e44', 'matte'), pos: [0.8, 0.6, 1.5] });
      keys(pyr, { pos: K([[0, [0.8, -1.2, 1.5], 'out'], [1.2, [0.8, 0.6, 1.5], 'hold'], [4.8, [0.8, 0.6, 1.5], 'in'], [6, [0.8, -1.2, 1.5]]]) });
      const copper = obj({ kind: 'shape', name: 'Copper star', shape: { type: 'star', r: 0.6, inner: 0.45, points: 5, d: 0.25 }, mat: E.defaultMat('#c8703f', 'copper'), pos: [2.4, 0.75, 1.4] });
      keys(copper, { rot: K([[0, [0, 0, 0], 'linear'], [L, [0, -720, 0]]]), scale: K([[0, [0.01, 0.01, 0.01], 'bounce'], [1, [1, 1, 1], 'hold'], [5.2, [1, 1, 1], 'in'], [6, [0.01, 0.01, 0.01]]]) });
      const glow = obj({ kind: 'shape', name: 'Glow capsule', shape: { type: 'capsule', r: 0.3, h: 0.8 }, mat: E.defaultMat('#ff4fd8', 'glow'), pos: [4, 0.7, 1.4] });
      keys(glow, { color: K([[0, '#ff4fd8', 'linear'], [2, '#4dabf7', 'linear'], [4, '#51cf66', 'linear'], [6, '#ff4fd8']]) });
      obj({ kind: 'shape', name: 'Rubber mat', shape: { type: 'cylinder', r: 6, h: 0.02 }, mat: E.defaultMat('#495057', 'rubber'), pos: [0, 0.01, 0.6] });
      { const { ball, keys: bk } = bouncingBall({ L, R: 0.9, x0: -4, x1: 4, z: -4, up: 3 }); tracks[ball.id] = { keys: bk }; }
      // a TV at the front, low down, with shaded rainbow bars scrolling down its screen
      const tvSize = E.shapeSize({ type: 'tv', size: 12 });
      obj({ kind: 'shape', name: 'TV: colour bars', shape: { type: 'tv', size: 12 }, mat: { ...E.defaultMat('#9aa1ab', 'plastic'), faces: JSON.parse(JSON.stringify(E.PART_COLOURS.tv)), cycle: { preset: 'raster', speed: 2, bands: 12, dir: 'down', part: 'screen' } }, pos: [-0.4, tvSize.y / 2, 4.6], rot: [0, -4, 0] });
      d.anim = { length: L, fps: 30, loop: true, tracks, camera: { move: 'turntable', amount: 360, start: 180 } };
      Object.assign(d.scene, { light: 'studio', bg: { type: 'gradient', c1: '#f4f6f9', c2: '#cfd8e3', angle: 0 }, groundColor: '#e9edf3', reflect: 1.2 });
      // the camera goes all the way round once, ending where it started, so the animation loops
      d.camera = { pos: [0, 3.4, 11.5], target: [0, 1.4, 0.5], fov: 40 };
    }
    if (kind === 'ball') {
      const L = 4, { ball, keys } = bouncingBall({ L, R: 1.6, x0: -5, x1: 5, z: 0, up: 4.2 });
      const grid = { type: 'pattern', pattern: 'grid', fg: '#3fe0b8', bg: '#244444', size: 3 };
      obj({ kind: 'shape', name: 'Grid wall', shape: { type: 'plane', w: 18, h: 10 }, mat: { ...E.defaultMat('#244444', 'matte'), faces: { all: grid } }, pos: [0, 5, -3] });
      obj({ kind: 'shape', name: 'Grid floor', shape: { type: 'plane', w: 18, h: 6 }, mat: { ...E.defaultMat('#244444', 'matte'), faces: { all: grid } }, pos: [0, 0.01, 0], rot: [-90, 0, 0] });
      d.anim = { length: L, fps: 30, loop: true, tracks: { [ball.id]: { keys } }, camera: { move: 'none', amount: 360 } };
      Object.assign(d.scene, { bg: { type: 'solid', color: '#1f3a3a' }, ground: false, light: 'studio', lightAngle: -35, lightPower: 1.1 });
      d.camera = { pos: [0, 4.6, 21], target: [0, 4.2, 0], fov: 38 };
    }
    await openDoc(d);
    if (kind === 'ball') { resetHistory(); if (window.TL3) { TL3.seek(0); TL3.play(); } }
    else if (kind === 'test') { resetHistory(); if (window.TL3) { TL3.seek(0); TL3.play(); } }
    else if (kind !== 'blank') { E.fit(); E.saveCamera(); resetHistory(); }
  }

  // ------------------------------------------------------------------ status bar
  function status() {
    if (!E.doc) { $('status').innerHTML = ''; return; }
    const m = sel();
    $('status').innerHTML = `<span><b>${esc(E.doc.name)}</b></span><span>${E.doc.objects.length} layers</span><span>${m ? 'Selected: ' + esc(m.name) : 'Nothing selected'}</span>`
      + `<span>${E.layout() === 'four' ? 'Four views' : 'One view'}</span><span>Dial turns: ${E.rotateTarget === 'all' ? 'the whole scene' : 'the selection'}</span><span>${autosaveFailed ? 'Too big to autosave: use Save' : dirty ? 'Not saved to a file yet' : 'Autosaves in this browser'}</span>`;
  }

  // ------------------------------------------------------------------ menus, ribbon, title bar
  const THEME_KEY = '3dcraft-theme';
  const getTheme = () => document.documentElement.dataset.theme || 'system';
  function setTheme(t) { if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  try { const t = localStorage.getItem(THEME_KEY); if (t) setTheme(t); } catch (e) {}
  const themeIsDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const THEME_BTN = document.createElement('button'); THEME_BTN.className = 'btn theme-btn'; THEME_BTN.type = 'button';
  const paintTheme = () => {
    const dark = themeIsDark(); THEME_BTN.title = dark ? 'Switch to light' : 'Switch to dark'; THEME_BTN.setAttribute('aria-label', THEME_BTN.title);
    THEME_BTN.innerHTML = dark ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  };
  THEME_BTN.onclick = () => { setTheme(themeIsDark() ? 'light' : 'dark'); paintTheme(); };
  paintTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);
  const has = () => !!sel();
  const MENUS = [
    ['File', [
      { label: 'New scene…', key: 'Ctrl+N', run: showStart },
      { label: 'Open…', key: 'Ctrl+O', run: () => $('open-input').click() },
      { label: 'Save', key: 'Ctrl+S', run: () => save(false), disabled: () => !E.doc },
      { label: 'Save as…', run: () => save(true), disabled: () => !E.doc },
      '-',
      { label: 'Render now (ray-traced picture)', run: () => renderNow(), disabled: () => !E.doc },
      { label: 'Render (ray-traced)…', key: 'F9', run: () => openRender(), disabled: () => !E.doc },
      { label: 'Export picture or 3D model…', key: 'Ctrl+E', run: openExport, disabled: () => !E.doc },
      { label: 'Bring in a 3D model (GLB, OBJ, STL)…', run: () => $('model-input').click(), disabled: () => !E.doc },
    ]],
    ['Edit', [
      { label: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => hIndex <= 0 },
      { label: 'Redo', key: 'Ctrl+Y', run: redo, disabled: () => hIndex >= history.length - 1 },
      '-',
      { label: 'Copy', key: 'Ctrl+C', run: copySel, disabled: () => !has() },
      { label: 'Paste', key: 'Ctrl+V', run: paste, disabled: () => !clipboard },
      { label: 'Duplicate', key: 'Ctrl+D', run: duplicate, disabled: () => !has() },
      { label: 'Delete', key: 'Del', run: del, disabled: () => !has() },
    ]],
    ['Insert', [
      ...Object.entries(E.SHAPES).map(([k, [n]]) => ({ label: n, run: () => addShape(k) })),
      '-',
      { label: '3D text', run: () => addText() },
      { label: 'Picture to 3D…', run: () => openTrace() },
      { label: 'Photo cut-out…', run: () => photoCutout(), disabled: () => !E.doc },
      { label: 'Symbol or emoji in 3D…', run: () => CraftSymbols.open({ onPick: addSymbol }) },
      { label: '3D model from a file…', run: () => $('model-input').click() },
    ]],
    ['Arrange', [
      { label: 'Move (W)', run: () => E.setMode('translate'), checked: () => E.mode() === 'translate' },
      { label: 'Turn (E)', run: () => E.setMode('rotate'), checked: () => E.mode() === 'rotate' },
      { label: 'Size (R)', run: () => E.setMode('scale'), checked: () => E.mode() === 'scale' },
      '-',
      { label: 'Group (pick layers with Ctrl+click)', key: 'Ctrl+G', run: groupPicked },
      { label: 'Ungroup', run: ungroup },
      { label: 'Stand on the ground', run: dropToGround, disabled: () => !has() },
      '-',
      { label: 'Dial turns the whole scene', run: () => { E.rotateTarget = 'all'; drawRotator(); }, checked: () => E.rotateTarget === 'all' },
      { label: 'Dial turns the selection', run: () => { E.rotateTarget = 'selected'; drawRotator(); }, checked: () => E.rotateTarget === 'selected' },
    ]],
    ['View', [
      { label: 'One big view', run: () => E.setLayout('one'), checked: () => E.layout() === 'one' },
      { label: 'Four views (top, front, right, 3D)', run: () => E.setLayout('four'), checked: () => E.layout() === 'four' },
      '-',
      { label: 'See everything', key: 'F', run: () => E.fit() },
      { label: 'Zoom to the selection', run: () => E.fit(true), disabled: () => !has() },
      { label: 'Front', key: '1', run: () => E.viewFrom('front') }, { label: 'Right side', key: '3', run: () => E.viewFrom('right') }, { label: 'Top', key: '7', run: () => E.viewFrom('top') }, { label: '¾ view', key: '5', run: () => E.viewFrom('three') },
      '-',
      { label: 'Show the grid', run: () => { E.showGrid = E.showGrid === false; E.redraw(); }, checked: () => E.showGrid !== false },
      { label: 'Show the timeline', run: () => toggleTimeline(), checked: () => !$('timeline').classList.contains('closed') },
      { heading: 'Theme' },
      { label: 'Match system', run: () => { setTheme('system'); paintTheme(); }, checked: () => getTheme() === 'system' },
      { label: 'Light', run: () => { setTheme('light'); paintTheme(); }, checked: () => getTheme() === 'light' },
      { label: 'Dark', run: () => { setTheme('dark'); paintTheme(); }, checked: () => getTheme() === 'dark' },
    ]],
    ['Animate', [
      { label: 'Play / pause', key: 'Space', run: () => TL3.play(), disabled: () => !E.doc },
      { label: 'Back to the start', key: 'Home', run: () => TL3.seek(0), disabled: () => !E.doc },
      { label: 'Export the animation…', run: () => ANIM3.open(), disabled: () => !E.doc },
      '-',
      { label: 'Loop', run: () => { const a = E.anim(); a.loop = !a.loop; changed(); TL3.render(); }, checked: () => !!E.doc && E.anim().loop },
    ]],
    ['Help', [
      { label: 'How to use 3DCraft', run: () => help() },
      { label: 'Load test scene', run: () => startScene('test') },
      { label: 'Load the bouncing ball demo', run: () => startScene('ball') },
      { label: 'Keyboard shortcuts', run: () => info('Keyboard shortcuts', keysHtml) },
      { label: 'About 3DCraft', run: () => info('About 3DCraft', aboutHtml) },
    ]],
  ];
  const help = () => info('How to use 3DCraft', `<h3>1. Start</h3><p>Pick a starter scene or an empty one.</p>
    <h3>2. Add things</h3><p>The <b>Add</b> tab and the Insert tab have shapes, <b>3D text</b> (any of 42 fonts, with depth and rounded edges), <b>Picture to 3D</b> (a logo or drawing is traced into colours and pulled out into 3D), <b>symbols and emoji in 3D</b>, and 3D models from GLB, OBJ or STL files.</p>
    <h3>3. Move, turn and size</h3><p>Click something, then drag its arrows (W), rings (E) or boxes (R). The <b>dial in the corner</b> turns the whole scene, or just the selected object: drag a coloured ring to turn around X, Y or Z, drag the ball to turn freely, click a letter to look along that axis. Drag in the view to look around, wheel to zoom.</p>
    <h3>4. Materials</h3><p>Pick plastic, gloss, matte, gold, silver, chrome, copper, glass, glow or rubber, then change colour, shine, metal, glass and glow. Put a picture, gradient or pattern on every face, or only the front, back, sides, top or bottom.</p>
    <h3>5. Layers and views</h3><p>The <b>Layers</b> list hides, locks, renames and groups things. View › Four views shows top, front, right and 3D at once.</p>
    <h3>6. Animate</h3><p>The <b>Timeline</b> under the view: pick a ready-made move (spin, bounce, fly in, fade…) for the selected object, or twirl a layer open (▸) and click a <b>stopwatch</b>; then move the playhead and change the object: each change becomes a keyframe ◆. The <b>Camera</b> row: look around, then ◆ keeps that view at the playhead (or pick a camera move). <b>3D text can move letter by letter</b>: pick a Letters move (typewriter, drop in, spin, scatter, wave…) or use Letter by letter on the right. Drag the timer bar's ends to set when a layer shows. Space plays. Export the animation as GIF, MP4, WebM, AVI or PNG frames.</p>
    <h3>7. Export</h3><p>Save a picture (up to 4K, or print sizes, see-through if you like) or a 3D model (GLB, OBJ, or STL for 3D printing).</p>`);
  const keysHtml = `<table class="keys">${[['New / Open / Save', 'Ctrl+N / O / S'], ['Export', 'Ctrl+E'], ['Undo / Redo', 'Ctrl+Z / Ctrl+Y'], ['Copy / Paste / Duplicate', 'Ctrl+C / V / D'], ['Delete', 'Delete'], ['Move / Turn / Size', 'W / E / R'], ['See everything', 'F'], ['Front / Right / Top / ¾ view', '1 / 3 / 7 / 5'], ['Play / pause', 'Space'], ['Start / end', 'Home / End'], ['Frame back / on', ', / .'], ['Group', 'Ctrl+G'], ['Deselect', 'Esc'], ['Search commands', 'Alt+Q']].map(([a, b]) => `<tr><td>${a}</td><td style="text-align:right;padding-left:20px">${b}</td></tr>`).join('')}</table>`;
  const aboutHtml = `<p><b>3DCraft</b> · version 0.4 (backdrops, ground and terrain, scenery, colour cycling)</p><p>3D titles, logos and scenes in your browser: shapes, 3D text, pictures turned into 3D, materials, lights, pictures of the scene and 3D models in and out. Works offline.</p><p>Built with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT), <a href="https://opentype.js.org" target="_blank" rel="noopener">opentype.js</a> (MIT) and ImageTracer (public domain). Fonts from Google Fonts (SIL Open Font License or Apache License), stored with the app.</p>`;
  const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="t3-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff922b"/><stop offset="1" stop-color="#7048e8"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="11" fill="url(#t3-g)"/><path d="M20 8l11 6v12l-11 6-11-6V14z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 14l11 6 11-6M20 20v12" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity=".85"/></svg>`;
  $('start-logo').innerHTML = LOGO;
  const I = window.CraftIcons;
  const item = (start) => MENUS.flatMap((m) => m[1]).find((it) => it && it.label && it.label.startsWith(start)) || {};
  const C = (start, label, icon, o = {}) => { const it = item(start); return { label: label || it.label, icon, key: it.key, run: () => it.run && it.run(), pressed: it.checked, disabled: it.disabled, ...o }; };
  const ico = { iconOnly: true };
  const toggleL = document.createElement('button'); toggleL.className = 'crb-small pc-toggle'; toggleL.textContent = 'Side panel'; toggleL.onclick = () => $('app').querySelector('.work').classList.toggle('show-left');
  const toggleR = document.createElement('button'); toggleR.className = 'crb-small pc-toggle'; toggleR.textContent = 'Properties'; toggleR.onclick = () => $('app').querySelector('.work').classList.toggle('show-right');
  const st = document.createElement('style'); st.textContent = '.crb .crb-small.pc-toggle { display: none; } @media (max-width: 980px) { .crb .crb-small.pc-toggle { display: inline-flex; } }'; document.head.append(st);
  const MI = { ball: '<circle cx="12" cy="10" r="7"/><path d="M8 5l3 0 0 3-3 0zM14 8l3 0 0 3-3 0zM8 11l3 0 0 3-3 0z" class="hue"/><path d="M6 21h12"/>', backdrop: '<path d="M3 18l5-6 4 4 3-3 6 5z" class="hue"/><path d="M2 20h20"/><circle cx="17" cy="7" r="2"/><path d="M5 9c1-2 4-2 5 0" opacity=".6"/>', shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>', test: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 14l3-4 3 3 2-2 3 3" class="hue"/><path d="M9 21h6M12 18v3"/>', render: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M12 3v18M3 7l9 4 9-4" opacity=".5"/><circle cx="17" cy="6" r="3" class="hue"/>', gold: '<circle cx="12" cy="12" r="8" class="hue"/><path d="M8 9a5 5 0 0 1 5-2" opacity=".7"/>', layout4: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8" class="hue"/>', layout1: '<rect x="3" y="4" width="18" height="16" rx="1.5"/>', move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>', turn: '<path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 4v5h-5" class="hue"/>', size: '<rect x="4" y="4" width="10" height="10"/><path d="M14 14l6 6M20 15v5h-5" class="hue"/>', text3d: '<path d="M5 6V4h12v2M11 4v14M8 18h6"/><path d="M17 6l2 2v12h-6l-2-2" opacity=".5"/>', trace: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6" class="hue"/>', model: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" class="hue"/>', ground: '<path d="M3 18h18"/><ellipse cx="12" cy="18" rx="6" ry="1.5" class="hue"/><rect x="9" y="8" width="6" height="8"/>', light: '<circle cx="12" cy="10" r="5"/><path d="M10 17h4M10 20h4" class="hue"/>', star: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z"/>' };
  const ribbon = window.CraftRibbon({
    mount: $('app'), storageKey: '3dcraft', extraEls: [toggleL, toggleR],
    tabs: [
      { id: 'home', label: 'Home', hue: '#e8590c', groups: [
        ['Scene', [C('New scene', 'New scene', I.newPage, { big: true }), { col: [C('Open', 'Open…', I.folder), C('Save', 'Save', I.save), C('Export', 'Export…', I.exportUp)] }]],
        ['Edit', [{ col: [C('Undo', 'Undo', I.undo), C('Redo', 'Redo', I.redo), C('Delete', 'Delete', I.trash)] }, { col: [C('Copy', 'Copy', I.copy), C('Paste', 'Paste', I.paste), C('Duplicate', 'Duplicate', I.duplicate)] }]],
        ['Handles', [C('Move', 'Move', MI.move, { big: true }), C('Turn', 'Turn', MI.turn, { big: true }), C('Size', 'Size', MI.size, { big: true })]],
        ['Render', [C('Render', 'Render', MI.render, { big: true, title: 'Ray-traced picture: real reflections, soft shadows and glass' })]],
        ['Help', [C('How to use', 'How to use 3DCraft', I.help, { big: true }), C('Load the bouncing ball demo', 'Ball demo', MI.ball, { big: true, title: 'A retro checkered ball bouncing and spinning in front of a grid' }), C('Load test scene', 'Load test scene', MI.test, { big: true, title: 'A scene for trying everything: letters spinning in and waving, glass, chrome, gold, copper, glow, plastic, matte and rubber, moves and a camera move' })]],
      ] },
      { id: 'insert', label: 'Insert', hue: '#7048e8', groups: [
        ['Shapes', [{ col: [{ row: ['box', 'roundbox', 'sphere', 'cylinder', 'trafficcone', 'pyramid', 'prism'].map((k) => ({ label: E.SHAPES[k][0], icon: SH_ICON[k], iconOnly: true, run: () => addShape(k) })) }, { row: ['torus', 'washer', 'capsule', 'star', 'heart', 'plane', 'stage'].map((k) => ({ label: E.SHAPES[k][0], icon: SH_ICON[k], iconOnly: true, run: () => addShape(k) })) }] }]],
        ['Words and pictures', [C('3D text', '3D text', MI.text3d, { big: true }), { label: 'Photo cut-out', icon: MI.trace, big: true, title: 'A photo cut out round its shape and pulled out into 3D, with the photo on it and an emboss', run: () => photoCutout() }, C('Picture to 3D', 'Picture to 3D', MI.trace, { big: true, title: 'Trace a logo or drawing into colours and pull it out into 3D' }), C('Symbol or emoji', 'Symbols & emoji', MI.star, { big: true })]],
        ['Objects', [{ col: [{ row: OBJECTS.slice(0, 5).map(([n, t, patch, ic]) => ({ label: n, icon: OBJ_ICON[ic], iconOnly: true, run: () => addShape(t, patch, n) })) }, { row: OBJECTS.slice(5).map(([n, t, patch, ic]) => ({ label: n, icon: OBJ_ICON[ic], iconOnly: true, run: () => addShape(t, patch, n) })) }] }]],
        ['Models', [C('3D model', '3D model', MI.model, { big: true, title: 'GLB, OBJ or STL' })]],
      ] },
      { id: 'material', label: 'Material', hue: '#c2255c', groups: [
        ['Material', Object.entries(E.MATERIALS).map(([k, [n, p]]) => ({ label: n, icon: MI.gold.replace('class="hue"', `fill="${p.color || '#3f7fe0'}" stroke="none"`), big: false, run: () => { const m = sel(); if (!m) return toast('Click an object first.'); Object.assign(m.mat, { preset: k, ...p }); changed(m.id); showProps(); }, pressed: () => !!sel() && sel().mat && sel().mat.preset === k })).reduce((a, x, i) => { if (i % 3 === 0) a.push({ col: [] }); a[a.length - 1].col.push(x); return a; }, [])],
      ] },
      { id: 'scene', label: 'Scene', hue: '#2f9e44', groups: [
        ['Lights', Object.entries(E.LIGHTS).map(([k, L]) => ({ label: L[0], icon: MI.light, run: () => { if (!E.doc) return; E.doc.scene.light = k; E.applyScene(); changed(); showProps(); }, pressed: () => !!E.doc && E.doc.scene.light === k })).reduce((a, x, i) => { if (i % 3 === 0) a.push({ col: [] }); a[a.length - 1].col.push(x); return a; }, [])],
        ['Ground', [{ col: [{ label: 'No ground', icon: MI.ground, run: () => window.BD3UI && BD3UI.setFloor('none'), pressed: () => !!(window.BD3UI && BD3UI.floorIs('none')) }, { label: 'Shadow only', icon: MI.ground, run: () => window.BD3UI && BD3UI.setFloor('shadow'), pressed: () => !!(window.BD3UI && BD3UI.floorIs('shadow')) }] }, { col: [{ label: 'Plain floor', icon: MI.ground, run: () => window.BD3UI && BD3UI.setFloor('floor'), pressed: () => !!(window.BD3UI && BD3UI.floorIs('floor')) }, { label: 'Landscape', icon: MI.ground, run: () => window.BD3UI && BD3UI.setFloor('land'), pressed: () => !!(window.BD3UI && BD3UI.floorIs('land')) }, { label: 'Ground settings', icon: I.gear, run: () => showTab('ground') }] }]],
        ['Scene settings', [{ label: 'Lights and camera', icon: I.gear, big: true, run: () => { E.select(null); showProps(); } }]],
      ] },
      { id: 'backdrop', label: 'Backdrop', hue: '#5f3dc4', groups: [
        ['Backdrop', [{ label: 'Choose a backdrop', icon: MI.backdrop, big: true, title: 'Pick a kind of backdrop: countryside, city, seaside, islands, playground, computer, space…', run: () => showTab('backdrop') }, { col: [{ label: 'Surprise me', icon: MI.shuffle, run: () => { showTab('backdrop'); BD3UI.newBackdrop(); } }, { label: 'Shuffle shapes', icon: MI.shuffle, run: () => BD3UI.shuffle() }, { label: 'Edit the layers', icon: I.gear, run: () => showTab('backdrop') }] }, { col: [{ label: 'Remove the backdrop', icon: I.trash, run: () => BD3UI.clear() }] }]],
        ['Style', [{ col: [['classic', 'Classic (flat)'], ['modern', 'Modern (3D)'], ['cardboard', 'Cardboard cut-outs']].map(([k, n]) => ({ label: n, icon: MI.backdrop, run: () => BD3UI.style(k), pressed: () => !!(E.doc && E.doc.backdrop && E.doc.backdrop.style === k) })) }]],
        ['Ground', [{ col: [{ label: 'Landscape ground', icon: MI.ground, run: () => window.BD3UI && BD3UI.setFloor(BD3UI.floorIs('land') ? 'floor' : 'land'), pressed: () => !!(window.BD3UI && BD3UI.floorIs('land')) }, { label: 'Terrain', icon: MI.ground, run: () => window.BD3UI && BD3UI.toggleLand('terrainOn'), pressed: () => !!(window.BD3UI && BD3UI.landIs('terrainOn')) }, { label: 'Eye candy', icon: MI.star, run: () => window.BD3UI && BD3UI.toggleLand('candyOn'), pressed: () => !!(window.BD3UI && BD3UI.landIs('candyOn')) }] }]],
        // palettes three to a column, so none drop off the bottom of the ribbon
        ['Palette', Object.entries(BD3.PALETTES).reduce((cols, [k, [n]], i) => { if (i % 3 === 0) cols.push({ col: [] }); cols[cols.length - 1].col.push({ label: n, icon: MI.light, run: () => BD3UI.palette(k), pressed: () => !!(E.doc && E.doc.backdrop && E.doc.backdrop.palette === k) }); return cols; }, [])],
      ] },
      { id: 'view', label: 'View', hue: '#1098ad', groups: [
        ['Layout', [C('One big view', 'One view', MI.layout1, { big: true }), C('Four views', 'Four views', MI.layout4, { big: true })]],
        ['Look from', [{ col: [C('Front', 'Front', I.screen), C('Right side', 'Right side', I.screen), C('Top', 'Top', I.screen)] }, { col: [C('¾ view', '¾ view', I.screen), C('See everything', 'See everything', I.fit), C('Zoom to the selection', 'Selection', I.zoomIn)] }]],
        ['Dial', [{ col: [C('Dial turns the whole scene', 'Dial turns all', MI.turn), C('Dial turns the selection', 'Dial turns selected', MI.turn)] }]],
      ] },
      { id: 'animate', label: 'Animate', hue: '#d6336c', groups: [
        ['Play', [{ label: 'Play', icon: '<path d="M7 5l12 7-12 7z" class="hue"/>', big: true, title: 'Play / pause (Space)', run: () => TL3.play() }, { col: [{ label: 'To the start', icon: '<path d="M6 5v14M18 5L8 12l10 7z"/>', run: () => TL3.seek(0) }, { label: 'Loop', icon: '<path d="M4 12a6 6 0 0 1 10-4.5L17 10M20 12a6 6 0 0 1-10 4.5L7 14"/><path d="M17 5v5h-5M7 19v-5h5" class="hue"/>', run: () => { const a = E.anim(); a.loop = !a.loop; changed(); TL3.render(); }, pressed: () => !!E.doc && E.anim().loop }] }]],
        ['Moves', [{ col: [['spin', 'Spin'], ['bounce', 'Bounce'], ['flyin', 'Fly in']].map(([k, n]) => ({ label: n, icon: MI.turn, run: () => TL3.preset(k) })) }, { col: [['fadein', 'Fade in'], ['grow', 'Grow in'], ['float', 'Float']].map(([k, n]) => ({ label: n, icon: MI.turn, run: () => TL3.preset(k) })) }]],
        ['Camera', [{ col: [{ label: 'Camera still', icon: I.screen, run: () => TL3.camera('none') }, { label: 'Turntable', icon: MI.turn, run: () => TL3.camera('turntable') }, { label: 'Swing', icon: MI.turn, run: () => TL3.camera('swing') }] }]],
        ['Timeline', [{ label: 'Timeline', icon: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M8 14h6" class="hue"/>', big: true, title: 'Show or hide the timeline', run: () => toggleTimeline(), pressed: () => !$('timeline').classList.contains('closed') }]],
        ['Save', [{ label: 'Export animation', icon: I.exportUp, big: true, title: 'GIF, MP4, WebM, AVI or PNG frames', run: () => ANIM3.open() }]],
      ] },
      { id: 'output', label: 'Export', hue: '#1c7ed6', groups: [
        ['Render', [C('Render', 'Render (ray-traced)', MI.render, { big: true, title: 'A photo-real picture: real reflections, soft shadows and glass. Pick a size and quality.' })]],
        ['Animation', [{ label: 'Export animation', icon: I.exportUp, big: true, title: 'GIF, MP4, WebM, AVI or PNG frames', run: () => ANIM3.open() }]],
        ['Export', [C('Export', 'Picture or 3D model…', I.exportUp, { big: true }), C('Bring in', 'Bring in a 3D model', I.import, { big: true })]],
        ['File', [C('Save', 'Save', I.save, { big: true }), { col: [C('Save as', 'Save as…', I.save), C('Open', 'Open…', I.folder)] }]],
      ] },
    ],
  });
  const tb = window.CraftTitlebar({
    appName: '3DCraft', storageKey: '3dcraft', colors: ['#ff922b', '#7048e8'], mount: $('app'), toast, logo: LOGO, menus: () => MENUS, ribbon,
    quick: [
      { icon: 'save', title: 'Save', key: 'Ctrl+S', run: () => save(false) },
      { icon: 'undo', title: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => hIndex <= 0 },
      { icon: 'redo', title: 'Redo', key: 'Ctrl+Y', run: redo, disabled: () => hIndex >= history.length - 1 },
      { icon: 'export', title: 'Export', key: 'Ctrl+E', run: openExport },
      { icon: 'new', title: 'New scene', run: showStart },
    ],
    getTitle: () => (E.doc ? E.doc.name : '3DCraft'),
    getStatus: () => (E.doc ? (dirty ? { text: 'Not saved to a file yet', dirty: true } : { text: 'Autosaves in this browser' }) : { text: '' }),
    getInfo: () => (E.doc ? [{ text: E.layout() === 'four' ? 'Four views' : 'One view', title: 'Switch views', run: () => E.setLayout(E.layout() === 'four' ? 'one' : 'four') }] : []),
    rightEls: [THEME_BTN],
    onHelp: help,
  });
  const app = $('app'); app.prepend(ribbon.el); app.prepend(tb.el);
  const fav = document.createElement('link'); fav.rel = 'icon'; fav.href = 'data:image/svg+xml,' + encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); document.head.append(fav);
  E.on('layout', () => { tb.update(); status(); setTimeout(drawRotator, 50); });
  E.on('mode', () => tb.update());

  // ------------------------------------------------------------------ keyboard
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (t.closest && (t.closest('input, textarea, select, [contenteditable]'))) return;
    if (!$('start').hidden || !$('tracedlg').hidden || !$('exportdlg').hidden || !$('info').hidden || !$('renderdlg').hidden || !$('animdlg').hidden) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 's') { e.preventDefault(); save(e.shiftKey); }
    else if (mod && k === 'o') { e.preventDefault(); $('open-input').click(); }
    else if (mod && k === 'n') { e.preventDefault(); showStart(); }
    else if (mod && k === 'e') { e.preventDefault(); openExport(); }
    else if (mod && k === 'd') { e.preventDefault(); duplicate(); }
    else if (mod && k === 'c') { copySel(); }
    else if (mod && k === 'v') { paste(); }
    else if (mod && k === 'g') { e.preventDefault(); groupPicked(); }
    else if (mod) return;
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); if (!(window.TL3 && TL3.deleteSelectedKey())) del(); }
    else if (k === ' ') { e.preventDefault(); TL3.play(); } else if (k === 'home') TL3.seek(0); else if (k === 'end') TL3.seek(E.anim().length);
    else if (k === ',') TL3.seek(E.time - 1 / E.anim().fps); else if (k === '.') TL3.seek(E.time + 1 / E.anim().fps);
    else if (k === 'w') E.setMode('translate'); else if (k === 'e') E.setMode('rotate'); else if (k === 'r') E.setMode('scale');
    else if (k === 'f') E.fit(); else if (k === 'escape') E.select(null); else if (k === 'f9') { e.preventDefault(); openRender(); }
    else if (k === '1') E.viewFrom('front'); else if (k === '3') E.viewFrom('right'); else if (k === '7') E.viewFrom('top'); else if (k === '5') E.viewFrom('three');
  });
  addEventListener('beforeunload', (e) => { if (dirty) { E.saveCamera(); try { localStorage.setItem(AUTOSAVE, snapshot()); } catch (er) {} } });

  // ------------------------------------------------------------------ start
  function toggleTimeline() { $('timeline').classList.toggle('closed'); try { localStorage.setItem('3dcraft-tl', $('timeline').classList.contains('closed') ? '0' : '1'); } catch (e) {} setTimeout(() => { E.redraw(); tb && tb.update(); }, 50); }
  try { if (localStorage.getItem('3dcraft-tl') === '0') $('timeline').classList.add('closed'); } catch (e) {}
  // Render now (title bar, left of Search): open the Render window and start a ray-traced still straight away
  const renderNow = () => { if (!E.doc || E.busy) return; openRender(); if (!$('rd-go').disabled) $('rd-go').click(); };
  {
    const sb = document.querySelector('.ctb-search');
    if (sb) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ctb-q text ctb-render'; b.id = 'render-now'; b.title = 'Render now: a ray-traced picture of the scene as it is (F9 opens the Render window)'; b.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 16 9 5 9-5M3 12l9 5 9-5"/></svg> Render now'; b.onclick = renderNow; sb.before(b); }
  }
  window.UI3 = { toast, photoCutout, showTab, setLetters, renderNow, openRender, addShape, addText, addSymbol, openTrace, startScene, openDoc, changed, showProps, renderLayers };
  (async () => {
    const last = localStorage.getItem(AUTOSAVE);
    if (last) { try { await openDoc(JSON.parse(last)); return; } catch (e) {} }
    showStart();
  })();
})();
