/* Fills (the same in every Craft app, own copy): colours, gradients, 33 patterns with dithers and pictures, and the fill picker. */
(function () {
  'use strict';
  // Fills and backgrounds (the same in every Craft app). A paint is { type, ... }:
  //   solid    { color }
  //   gradient { c1, c2, angle (deg), radial, dither }   dither adds fine noise so gradients do not show bands
  //   pattern  { pattern, fg, bg, size (tile size: mm in print apps, px in SiteCraft) }
  //   picture  { src, fit: cover | contain | tile | stretch, opacity }
  // Patterns are drawn on a small square tile, fg on bg (bg '' = see-through).
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const PATTERNS = [
    // dithers: ordered (Bayer) dots at a set darkness, a random dither and a halftone
    ...[12, 25, 37, 50, 62, 75, 88].map((p) => [`dither${p}`, `Dither ${p}%`, 'Dithers', (x, n, fg) => { const c = n / 4; x.fillStyle = fg; BAYER4.forEach((t, i) => { if ((t + 0.5) / 16 < p / 100) x.fillRect((i % 4) * c, Math.floor(i / 4) * c, c, c); }); }]),
    ['noise', 'Random dither 50%', 'Dithers', (x, n, fg) => { const c = n / 16; x.fillStyle = fg; let s = 12345; for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; if (s % 2) x.fillRect((i % 16) * c, Math.floor(i / 16) * c, c, c); } }],
    ['halftone', 'Halftone dots', 'Dithers', (x, n, fg) => { x.fillStyle = fg; [[0.25, 0.25], [0.75, 0.75]].forEach(([a, b]) => { x.beginPath(); x.arc(a * n, b * n, n * 0.2, 0, 7); x.fill(); }); }],
    // lines
    ['hstripes', 'Stripes across', 'Lines', (x, n, fg) => { x.fillStyle = fg; x.fillRect(0, 0, n, n / 2); }],
    ['vstripes', 'Stripes down', 'Lines', (x, n, fg) => { x.fillStyle = fg; x.fillRect(0, 0, n / 2, n); }],
    ['diag', 'Diagonal lines', 'Lines', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.22; x.beginPath(); for (let k = -1; k <= 1; k++) { x.moveTo(k * n, n); x.lineTo(k * n + n, 0); } x.stroke(); }],
    ['diag2', 'Diagonal lines (other way)', 'Lines', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.22; x.beginPath(); for (let k = -1; k <= 1; k++) { x.moveTo(k * n, 0); x.lineTo(k * n + n, n); } x.stroke(); }],
    ['pinstripe', 'Pinstripes', 'Lines', (x, n, fg) => { x.fillStyle = fg; x.fillRect(0, 0, Math.max(1, n * 0.1), n); }],
    ['grid', 'Grid', 'Lines', (x, n, fg) => { x.fillStyle = fg; const w = Math.max(1, n * 0.1); x.fillRect(0, 0, n, w); x.fillRect(0, 0, w, n); }],
    ['cross', 'Crosshatch', 'Lines', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.12; x.beginPath(); for (let k = -1; k <= 1; k++) { x.moveTo(k * n, n); x.lineTo(k * n + n, 0); x.moveTo(k * n, 0); x.lineTo(k * n + n, n); } x.stroke(); }],
    ['zigzag', 'Zigzag', 'Lines', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.14; x.beginPath(); x.moveTo(0, n * 0.7); x.lineTo(n / 2, n * 0.3); x.lineTo(n, n * 0.7); x.stroke(); }],
    ['waves', 'Waves', 'Lines', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.12; x.beginPath(); x.moveTo(0, n / 2); x.bezierCurveTo(n * 0.25, n * 0.15, n * 0.25, n * 0.15, n / 2, n / 2); x.bezierCurveTo(n * 0.75, n * 0.85, n * 0.75, n * 0.85, n, n / 2); x.stroke(); }],
    // shapes
    ['checks', 'Checkerboard', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.fillRect(0, 0, n / 2, n / 2); x.fillRect(n / 2, n / 2, n / 2, n / 2); }],
    ['dots', 'Polka dots', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.beginPath(); x.arc(n / 2, n / 2, n * 0.18, 0, 7); x.fill(); }],
    ['bricks', 'Bricks', 'Shapes', (x, n, fg) => { x.fillStyle = fg; const w = Math.max(1, n * 0.08); x.fillRect(0, 0, n, w); x.fillRect(0, n / 2, n, w); x.fillRect(0, 0, w, n / 2); x.fillRect(n / 2, n / 2, w, n / 2); }],
    ['diamonds', 'Diamonds', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.beginPath(); x.moveTo(n / 2, n * 0.1); x.lineTo(n * 0.9, n / 2); x.lineTo(n / 2, n * 0.9); x.lineTo(n * 0.1, n / 2); x.fill(); }],
    ['scales', 'Fish scales', 'Shapes', (x, n, fg) => { x.strokeStyle = fg; x.lineWidth = n * 0.08; [[0, 0], [n, 0], [n / 2, n / 2], [0, n], [n, n]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, n / 2, 0, Math.PI); x.stroke(); }); }],
    ['triangles', 'Triangles', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.beginPath(); x.moveTo(0, n); x.lineTo(n / 2, n * 0.15); x.lineTo(n, n); x.fill(); }],
    ['plus', 'Plus signs', 'Shapes', (x, n, fg) => { x.fillStyle = fg; const w = n * 0.12; x.fillRect(n / 2 - w / 2, n * 0.25, w, n / 2); x.fillRect(n * 0.25, n / 2 - w / 2, n / 2, w); }],
    ['stars', 'Little stars', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? n * 0.13 : n * 0.32, a = (i * Math.PI) / 5; x.lineTo(n / 2 + r * Math.sin(a), n / 2 - r * Math.cos(a)); } x.fill(); }],
    ['hearts', 'Little hearts', 'Shapes', (x, n, fg) => { x.fillStyle = fg; x.beginPath(); x.moveTo(n / 2, n * 0.78); x.bezierCurveTo(n * 0.1, n * 0.5, n * 0.2, n * 0.18, n / 2, n * 0.35); x.bezierCurveTo(n * 0.8, n * 0.18, n * 0.9, n * 0.5, n / 2, n * 0.78); x.fill(); }],
    ['weave', 'Basket weave', 'Shapes', (x, n, fg) => { x.fillStyle = fg; const h = n / 2, s = h / 6; for (let i = 0; i < 3; i++) { const o = i * (h / 3) + s / 2; x.fillRect(0, o, h, s); x.fillRect(h, h + o, h, s); x.fillRect(h + o, 0, s, h); x.fillRect(o, h, s, h); } }],
  ];
  const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p[0], p]));
  // A pattern tile as a canvas `px` pixels square (crisp: no smoothing, whole pixels for dithers).
  function patternTile(id, fg = '#222222', bg = '#ffffff', px = 16) {
    // whole pixels per cell so dithers stay crisp: tiles are a multiple of 4 (16 for the random dither), at least 8 (24 for the weave)
    let n = Math.max(id === 'weave' ? 24 : 8, Math.round(px / 4) * 4); if (id === 'noise') n = Math.max(16, Math.round(n / 16) * 16);
    const c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, n, n); }
    (PATTERN_BY_ID[id] || PATTERNS[3])[3](x, n, fg || '#222222');
    return c;
  }
  // A gradient drawn into a canvas; with dither, a little noise (under one colour step) hides the bands of 8-bit colour.
  function gradientCanvas(w, h, f) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d'), a = ((f.angle ?? 90) * Math.PI) / 180, cx = c.width / 2, cy = c.height / 2;
    let g;
    if (f.radial) g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(cx, cy));
    else { const r = (Math.abs(Math.sin(a)) * c.width + Math.abs(Math.cos(a)) * c.height) / 2; g = x.createLinearGradient(cx - Math.sin(a) * r, cy + Math.cos(a) * r, cx + Math.sin(a) * r, cy - Math.cos(a) * r); }
    g.addColorStop(0, f.c1 || '#ffffff'); g.addColorStop(1, f.c2 || '#3f8be8');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (f.dither) ditherCanvas(c);
    return c;
  }
  // Fine dither: ordered noise of up to ±1 colour step, only where the colour changes smoothly (flat areas stay exact).
  function ditherCanvas(c) {
    const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width;
    for (let i = 0; i < d.length; i += 4) {
      const p = i / 4, t = (BAYER4[(p % w) % 4 + ((Math.floor(p / w) % 4) * 4)] + 0.5) / 16 - 0.5;
      const right = i + 4 < d.length ? i + 4 : i - 4, down = i + w * 4 < d.length ? i + w * 4 : i - w * 4;
      for (let k = 0; k < 3; k++) { const v = d[i + k]; if (Math.abs(v - d[right + k]) <= 3 && Math.abs(v - d[down + k]) <= 3 && (v !== d[right + k] || v !== d[down + k])) d[i + k] = Math.max(0, Math.min(255, Math.round(v + t * 2.2))); }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  // The whole fill painted into a w × h canvas (pixels). `img` is the loaded picture for picture fills; `unit` = tile pixels per size unit.
  function paintCanvas(w, h, f, img, unit = 1) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d');
    if (!f || f.type === 'none') return c;
    if (f.type === 'solid') { x.fillStyle = f.color || '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
    else if (f.type === 'gradient') x.drawImage(gradientCanvas(c.width, c.height, f), 0, 0);
    else if (f.type === 'pattern') { x.imageSmoothingEnabled = false; x.fillStyle = x.createPattern(patternTile(f.pattern, f.fg, f.bg, (f.size || 4) * unit), 'repeat'); x.fillRect(0, 0, c.width, c.height); }
    else if (f.type === 'picture' && img) {
      x.globalAlpha = f.opacity ?? 1;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, fit = f.fit || 'cover';
      if (fit === 'tile') { const k = ((f.size || 0) * unit) / iw || 1, t = document.createElement('canvas'); t.width = Math.max(1, iw * k); t.height = Math.max(1, ih * k); t.getContext('2d').drawImage(img, 0, 0, t.width, t.height); x.fillStyle = x.createPattern(t, 'repeat'); x.fillRect(0, 0, c.width, c.height); }
      else if (fit === 'stretch') x.drawImage(img, 0, 0, c.width, c.height);
      else { const k = (fit === 'cover' ? Math.max : Math.min)(c.width / iw, c.height / ih); x.drawImage(img, (c.width - iw * k) / 2, (c.height - ih * k) / 2, iw * k, ih * k); }
    }
    return c;
  }
  const paintImgCache = new Map();
  const loadPaintImg = (src) => { if (!src) return Promise.resolve(null); if (!paintImgCache.has(src)) paintImgCache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })); return paintImgCache.get(src); };
  // A short description for lists and tooltips.
  const paintLabel = (f) => (!f || f.type === 'none' ? 'None' : f.type === 'solid' ? 'Colour' : f.type === 'gradient' ? (f.radial ? 'Round gradient' : 'Gradient') : f.type === 'pattern' ? (PATTERN_BY_ID[f.pattern] || ['', 'Pattern'])[1] : 'Picture');
  // Defaults when switching type, keeping the colours already chosen.
  function paintSwitch(f, type, base = '#3f8be8') {
    const c = (f && (f.color || f.c1 || f.fg)) || base;
    const light = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return false; const v = parseInt(m[1], 16); return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 200; };
    const ink = light(c) ? '#3f6fd8' : c, other = light(c) ? '#3f6fd8' : '#ffffff'; // a white page gets a colour that shows
    if (type === 'none') return { type: 'none' };
    if (type === 'solid') return { type, color: c };
    if (type === 'gradient') return { type, c1: c, c2: (f && f.c2) || other, angle: (f && f.angle) ?? 90, radial: !!(f && f.radial), dither: f && f.dither != null ? f.dither : true };
    if (type === 'pattern') return { type, pattern: (f && f.pattern) || 'dither50', fg: f && f.fg ? f.fg : ink, bg: (f && f.bg != null ? f.bg : '#ffffff'), size: (f && f.size) || 3 };
    return { type: 'picture', src: (f && f.src) || '', fit: (f && f.fit) || 'cover', opacity: (f && f.opacity) ?? 1, size: (f && f.size) || 20 };
  }
  // The fill picker as plain HTML (the same in every Craft app): none, colour, gradient, pattern or picture.
  // paintPicker(paint, apply, { none: 'None' | null, base, label, unit: 'mm' | 'px', sizeMax, pickPicture }) → element.
  // apply(newPaint) is called after every change; rebuild the picker from the new paint to show the new controls.
  function paintPicker(f, apply, o = {}) {
    if (!document.getElementById('pp-style')) {
      const st = document.createElement('style'); st.id = 'pp-style';
      st.textContent = '.pp{display:grid;gap:7px;margin:4px 0 8px}.pp-seg{display:flex;flex-wrap:wrap;gap:2px;padding:2px;border:1px solid var(--line,#ccc);border-radius:7px;background:var(--panel-2,#f3f3f3)}'
        + '.pp-seg button{flex:1 1 auto;min-width:0;white-space:nowrap;border:0;background:none;color:inherit;padding:4px 6px;border-radius:5px;cursor:pointer;font:inherit;font-size:12px}'
        + '.pp-seg button[aria-pressed=true]{background:var(--panel,#fff);color:var(--accent,#2f6fdd);box-shadow:0 1px 2px rgba(0,0,0,.12)}'
        + '.pp label{display:grid;gap:3px;font-size:12px;color:var(--muted,#666)}.pp .pp-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
        + '.pp input[type=color]{width:100%;height:28px;padding:2px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--panel,#fff)}'
        + '.pp select{height:28px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--panel,#fff);color:var(--fg,inherit);font:inherit;font-size:12px}'
        + '.pp .pp-check{display:flex;gap:6px;align-items:center;font-size:12px;color:inherit}.pp .pp-swatch{height:30px;border:1px solid var(--line,#ccc);border-radius:6px;image-rendering:pixelated}'
        + '.pp .pp-btn{height:28px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--panel,#fff);color:inherit;cursor:pointer;font:inherit;font-size:12px}';
      document.head.append(st);
    }
    f = f || { type: 'none' };
    const unit = o.unit || 'mm', set = (patch) => apply({ ...f, ...patch });
    const choose = o.pickPicture || (() => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const fl = i.files[0]; if (!fl) return res(null); const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(fl); }; i.click(); }));
    const el = document.createElement('div'); el.className = 'pp';
    const mk = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.flat().forEach((k) => k != null && e.append(k)); return e; };
    const color = (label, key, v) => mk('label', {}, label, mk('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff', onchange: (e) => set({ [key]: e.target.value }) }));
    const check = (label, v, on) => mk('label', { className: 'pp-check' }, mk('input', { type: 'checkbox', checked: !!v, onchange: (e) => on(e.target.checked) }), label);
    const range = (label, v, min, max, show, on) => { const b = mk('b', { textContent: show(v) }); const r = mk('input', { type: 'range', min, max, value: v, oninput: (e) => { b.textContent = show(+e.target.value); }, onchange: (e) => on(+e.target.value) }); return mk('label', {}, mk('span', {}, label + ': ', b), r); };
    const select = (label, v, opts, on) => mk('label', {}, label, mk('select', { onchange: (e) => on(e.target.value) }, opts.map(([a, b]) => mk('option', { value: a, textContent: b, selected: String(a) === String(v) }))));
    const TYPES = [...(o.none === null ? [] : [['none', o.none || 'None']]), ['solid', 'Colour'], ['gradient', 'Gradient'], ['pattern', 'Pattern'], ['picture', 'Picture']];
    const pick = async (type) => { const n = paintSwitch(f, type, o.base); if (unit === 'px' && type === 'pattern' && !(f && f.size)) n.size = 12; if (unit === 'px' && type === 'picture' && !(f && f.size)) n.size = 120; if (type === 'picture' && !n.src) { const src = await choose(); if (!src) return; n.src = src; } apply(n); };
    if (o.label) el.append(mk('span', { style: 'font-size:12px;color:var(--muted,#666)', textContent: o.label }));
    el.append(mk('div', { className: 'pp-seg', role: 'group' }, TYPES.map(([v, n]) => mk('button', { type: 'button', textContent: n, onclick: () => pick(v) }, null)).map((b, i) => { b.setAttribute('aria-pressed', String(f.type === TYPES[i][0])); return b; })));
    if (f.type === 'solid') el.append(color('Colour', 'color', f.color));
    if (f.type === 'gradient') {
      el.append(mk('div', { className: 'pp-row' }, color('From', 'c1', f.c1), color('To', 'c2', f.c2)));
      if (!f.radial) el.append(range('Angle', f.angle ?? 90, 0, 359, (v) => v + '°', (v) => set({ angle: v })));
      el.append(check('Round (from the middle out)', f.radial, (v) => set({ radial: v })));
      if (o.dither !== false) el.append(check('Smooth (dither): no colour bands', f.dither, (v) => set({ dither: v })));
    }
    if (f.type === 'pattern') {
      el.append(select('Pattern', f.pattern, PATTERNS.map(([v, n, g]) => [v, `${g}: ${n}`]), (v) => set({ pattern: v })));
      const sw = mk('div', { className: 'pp-swatch' }); sw.style.background = `url(${patternTile(f.pattern, f.fg, f.bg, 24).toDataURL()}) repeat`; sw.style.backgroundSize = '24px'; el.append(sw);
      el.append(mk('div', { className: 'pp-row' }, color('Ink', 'fg', f.fg), color('Background', 'bg', f.bg || '#ffffff')));
      el.append(check('See-through between the ink', !f.bg, (v) => set({ bg: v ? '' : '#ffffff' })));
      el.append(range('Pattern size', f.size || (unit === 'px' ? 12 : 3), 1, unit === 'px' ? 120 : 30, (v) => v + ' ' + unit, (v) => set({ size: v })));
    }
    if (f.type === 'picture') {
      el.append(select('Fit', f.fit || 'cover', [['cover', 'Fill (crop to fit)'], ['contain', 'Fit (whole picture)'], ['stretch', 'Stretch'], ['tile', 'Tile (repeat)']], (v) => set({ fit: v })));
      if (f.fit === 'tile') el.append(range('Tile width', f.size || (unit === 'px' ? 120 : 20), 3, unit === 'px' ? 1200 : 200, (v) => v + ' ' + unit, (v) => set({ size: v })));
      el.append(range('Picture strength', Math.round((f.opacity ?? 1) * 100), 5, 100, (v) => v + '%', (v) => set({ opacity: v / 100 })));
      el.append(mk('button', { type: 'button', className: 'pp-btn', textContent: 'Choose another picture…', onclick: async () => { const src = await choose(); if (src) set({ src }); } }));
    }
    return el;
  }
  Object.assign(window, { PATTERNS, patternTile, gradientCanvas, ditherCanvas, paintCanvas, loadPaintImg, paintLabel, paintSwitch, paintPicker });
})();
