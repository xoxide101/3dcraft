/* 3DCraft backdrop (window.BD3): layers of scenery from back to front, like the flats of a stage or the layers of an
   old video game. Each layer is made from its seed (sun or moon, stars, clouds, mountains, hills, treeline, city, sea),
   coloured by a palette with farther layers hazier, in the Classic style (flat cut-outs with an embossed edge and a drop
   shadow), Modern (soft rounded 3D) or Cardboard (cut-outs with a cardboard edge, propped up by fold-out stands). All layers stand 75 to 100 units out (the back one farthest), centred on the
   scene and turned to stay behind it from wherever the camera looks, so they always stack towards the subject. Layers scroll at their own speed (an endless loop or passing by once), bob, and
   fly in, rise up or slide in, and out again, on the timeline. Saved as doc.backdrop. */
(function () {
  'use strict';
  const E = window.E3, T = window.THREE, BD = (window.BD3 = {});

  BD.KINDS = {
    sun: ['Sun or moon', { speed: 0, bob: 0 }],
    stars: ['Stars', { speed: 0.2, bob: 0 }],
    clouds: ['Clouds', { speed: 1, bob: 0.25 }],
    mountains: ['Mountains', { speed: 1, bob: 0 }],
    hills: ['Hills', { speed: 1, bob: 0 }],
    trees: ['Treeline', { speed: 1, bob: 0 }],
    city: ['City skyline', { speed: 1, bob: 0 }],
    sea: ['Sea', { speed: 1, bob: 0.35 }],
    islands: ['Islands', { speed: 1, bob: 0 }],
    playground: ['Playground', { speed: 1, bob: 0 }],
    circuit: ['Circuit board', { speed: 1, bob: 0 }],
    pixels: ['Floating pixels', { speed: 0.6, bob: 0.3 }],
    birds: ['Birds', { speed: 1.4, bob: 0.4 }],
    balloons: ['Hot-air balloons', { speed: 0.5, bob: 0.5 }],
    rainbow: ['Rainbow', { speed: 0, bob: 0 }],
    planets: ['Planets', { speed: 0.1, bob: 0 }],
    picture: ['Picture (your own)', { speed: 1, bob: 0, size: 1, repeat: 1, removeBg: true, border: true, emboss: 1 }],
  };
  // kinds that float in the sky (Cardboard holds them up on sticks)
  BD.SKY = ['clouds', 'pixels', 'birds', 'balloons', 'rainbow', 'planets'];
  // palettes: the sky (top, horizon), the haze far layers fade into, and a colour for each kind
  BD.PALETTES = {
    day: ['Day', { sky: ['#6fb0ee', '#e4f1fb'], haze: '#d6e7f5', sun: '#ffd84d', stars: '#ffffff', clouds: '#ffffff', mountains: '#7486a3', hills: '#64ad55', trees: '#2c7339', city: '#56677c', sea: '#2f86c8', windows: '#3a4a5c', lit: false, islands: '#3f9a4a', sand: '#e9d29a', playground: '#e03131', circuit: '#2f6b4f', traces: '#c9f2d8', pixels: '#4dabf7', birds: '#2b2f38', balloons: '#e8590c', rainbow: '#ffffff', planets: '#adb5bd' }],
    sunset: ['Sunset', { sky: ['#ff7a59', '#ffd59e'], haze: '#f7b48e', sun: '#fff0a0', stars: '#fff4e0', clouds: '#ffc0a4', mountains: '#7a4f74', hills: '#a3566b', trees: '#4b2e4f', city: '#3c2a46', sea: '#d9775c', windows: '#ffd27a', lit: true, islands: '#5a3d5c', sand: '#e7a77a', playground: '#c2255c', circuit: '#3a2846', traces: '#ffd27a', pixels: '#ffa94d', birds: '#2a1d2e', balloons: '#f76707', rainbow: '#ffffff', planets: '#e599f7' }],
    night: ['Night', { sky: ['#070b1e', '#22325e'], haze: '#273763', sun: '#eef1f6', stars: '#ffffff', clouds: '#56678a', mountains: '#1d2846', hills: '#18352f', trees: '#0e221e', city: '#141a2d', sea: '#13305a', windows: '#ffd86b', lit: true, islands: '#16302b', sand: '#3d4a6b', playground: '#5c7cfa', circuit: '#101a33', traces: '#66d9e8', pixels: '#74c0fc', birds: '#c5cee0', balloons: '#ffa94d', rainbow: '#ffffff', planets: '#d0bfff' }],
    desert: ['Desert', { sky: ['#f2b56b', '#fdebc8'], haze: '#f2d7ad', sun: '#fff3c4', stars: '#ffffff', clouds: '#fff6e8', mountains: '#b8704a', hills: '#e2a868', trees: '#6f8a35', city: '#a46f4c', sea: '#3fa7a0', windows: '#5a4030', lit: false, islands: '#8a9a3a', sand: '#efcf8f', playground: '#e8590c', circuit: '#7a5638', traces: '#ffe8a3', pixels: '#ffa94d', birds: '#4a3528', balloons: '#d9480f', rainbow: '#ffffff', planets: '#ffc078' }],
    storm: ['Storm', { sky: ['#343b4a', '#8b95a7'], haze: '#97a1b0', sun: '#d8dee9', stars: '#e5e9f0', clouds: '#6b7280', mountains: '#4b5563', hills: '#4c6848', trees: '#2b3b2a', city: '#384150', sea: '#3c596b', windows: '#cfd6e0', lit: false, islands: '#3d5a3a', sand: '#b8b09a', playground: '#868e96', circuit: '#36404d', traces: '#a5d8ff', pixels: '#91a7ff', birds: '#1f242c', balloons: '#868e96', rainbow: '#ffffff', planets: '#ced4da' }],
  };
  BD.PALETTES.digital = ['Digital', { sky: ['#04050d', '#13284a'], haze: '#163a5c', sun: '#ff4fd8', stars: '#7fffd4', clouds: '#1b4d6b', mountains: '#123c5a', hills: '#0e4d45', trees: '#0b3b3a', city: '#0c2238', sea: '#0a3a5c', windows: '#39ff14', lit: true, islands: '#0e4d45', sand: '#1b4d6b', playground: '#22d3ee', circuit: '#0d3b4f', traces: '#39ff88', pixels: '#22d3ee', birds: '#7fffd4', balloons: '#ff4fd8', rainbow: '#ffffff', planets: '#be4bdb' }];
  BD.MOVES_IN = { none: 'Already there', fly: 'Fly in from above', rise: 'Rise up from below', slide: 'Slide in from the side' };
  BD.MOVES_OUT = { none: 'Stays', fly: 'Fly out upwards', rise: 'Sink down', slide: 'Slide out to the side' };

  // ---------------------------------------------------------------- the model
  let nextId = 1;
  const uid = () => 'bd' + Date.now().toString(36) + (nextId++);
  BD.NEAR = 75; BD.FAR = 100;
  // how far out each layer stands: spread evenly from the back (FAR) to the front (NEAR) in stack order
  BD.distOf = (i, n) => (n <= 1 ? (BD.FAR + BD.NEAR) / 2 : BD.FAR - ((BD.FAR - BD.NEAR) * i) / (n - 1));
  BD.newLayer = (kind, o = {}) => ({ id: uid(), kind, seed: Math.floor(Math.random() * 1e6), height: 1, y: 0, haze: 1, color: null, style: null, visible: true, ...BD.KINDS[kind][1], enter: { move: 'none', at: 0, dur: 1.5 }, exit: { move: 'none', at: 3.5, dur: 1.5 }, ...o });
  BD.get = () => (E.doc && E.doc.backdrop) || null;
  BD.ensure = () => { if (!E.doc.backdrop) E.doc.backdrop = { on: true, style: 'classic', palette: 'day', speed: 0, mode: 'loop', layers: [] }; return E.doc.backdrop; };
  // ready-made backdrops to choose from: [name, layers (back to front), palettes that suit it]
  BD.THEMES = {
    countryside: ['Countryside', ['sun', 'clouds', 'mountains', 'hills', 'trees'], ['day', 'sunset', 'storm']],
    city: ['City', ['sun', 'clouds', 'city', ['city', { height: 0.8 }]], ['day', 'sunset', 'night']],
    seaside: ['Seaside', ['sun', 'clouds', 'birds', 'mountains', 'sea'], ['day', 'sunset']],
    islands: ['Ocean and islands', ['sun', 'clouds', 'birds', 'islands', 'sea'], ['day', 'sunset', 'night']],
    desert: ['Desert', ['sun', 'mountains', 'hills', ['hills', { height: 0.7 }]], ['desert']],
    nightcity: ['Night city', ['stars', 'sun', 'city', ['city', { height: 0.8 }]], ['night']],
    playground: ['Playground', ['sun', 'clouds', 'balloons', 'trees', 'playground'], ['day', 'sunset']],
    computer: ['Computer', ['pixels', 'sun', ['circuit', { height: 1.4 }], 'circuit'], ['digital']],
    rainbow: ['Rainbow meadow', ['rainbow', 'clouds', 'hills', 'trees'], ['day']],
    balloons: ['Balloon festival', ['sun', 'clouds', 'balloons', 'hills', ['balloons', { height: 0.6 }]], ['day', 'sunset']],
    space: ['Space', ['stars', 'planets', 'mountains', ['hills', { height: 0.6 }]], ['night', 'digital']],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  BD.useTheme = function (key, palette) {
    const bd = BD.ensure(), [, kinds, pals] = BD.THEMES[key] || BD.THEMES.countryside;
    bd.on = true; bd.theme = key; bd.palette = palette || pick(pals);
    bd.layers = kinds.map((k) => (Array.isArray(k) ? BD.newLayer(k[0], k[1]) : BD.newLayer(k)));
    BD.applyPalette(bd.palette);
  };
  BD.random = () => BD.useTheme(pick(Object.keys(BD.THEMES)));
  BD.shuffle = () => { const bd = BD.get(); if (bd) bd.layers.forEach((l) => { l.seed = Math.floor(Math.random() * 1e6); }); };
  // a palette also sets the sky behind everything
  BD.applyPalette = function (name) {
    const bd = BD.ensure(), P = (BD.PALETTES[name] || BD.PALETTES.day)[1];
    bd.palette = name; E.doc.scene.bg = { type: 'gradient', c1: P.sky[1], c2: P.sky[0], angle: 0, dither: true };
    E.applyScene();
  };

  // ---------------------------------------------------------------- shapes from seeds
  // a small seeded random generator, so a layer always comes out the same from its seed
  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // waves whose whole number of cycles fits the period, so a layer joins up with itself when it loops
  function waves(r, P, list) { return list.map(([n0, n1, amp]) => ({ n: n0 + Math.floor(r() * (n1 - n0 + 1)), a: amp * (0.6 + 0.8 * r()), ph: r() * Math.PI * 2 })); }
  const sumWaves = (ws, P, x) => ws.reduce((s, w) => s + w.a * Math.sin((w.n * x * Math.PI * 2) / P + w.ph), 0);
  const ridge = (ws, P, x) => ws.reduce((s, w) => s + w.a * (1 - Math.abs(Math.sin((w.n * x * Math.PI) / P + w.ph))) ** 1.6, 0);
  const periodOf = (d) => Math.max(26, Math.round(d * 1.7));
  // the top edge of a ground layer as points [x, y] over three periods (from -1.5P to 1.5P)
  function skyline(l, P, d) {
    const r = rng(l.seed), H = l.height ?? 1, pts = [], N = 3 * 180;
    const at = (fn) => { for (let i = 0; i <= N; i++) { const x = -1.5 * P + (3 * P * i) / N; pts.push([x, fn(x)]); } return pts; };
    if (l.kind === 'hills') { const ws = waves(r, P, [[1, 2, 1], [2, 4, 0.5], [5, 8, 0.15]]); return at((x) => d * H * (0.05 + 0.025 * sumWaves(ws, P, x))); }
    if (l.kind === 'mountains') { const ws = waves(r, P, [[2, 4, 1], [5, 9, 0.45], [11, 19, 0.18], [23, 37, 0.07]]); return at((x) => d * H * (0.03 + 0.09 * ridge(ws, P, x))); }
    if (l.kind === 'sea') { const ws = waves(r, P, [[18, 26, 1], [31, 45, 0.5]]); return at((x) => d * H * (0.012 + 0.0025 * sumWaves(ws, P, x))); }
    if (l.kind === 'trees') {
      const ws = waves(r, P, [[1, 3, 1], [4, 7, 0.4]]), trees = [], n = Math.round(P / (d * 0.022));
      for (let i = 0; i < n; i++) trees.push({ x: (i + r() * 0.8) * (P / n) - P / 2, w: d * (0.018 + 0.016 * r()), h: d * (0.035 + 0.035 * r()), pine: r() < 0.6 });
      const base = (x) => d * H * (0.012 + 0.008 * sumWaves(ws, P, x));
      return at((x) => {
        let y = base(x);
        for (const t of trees) for (const k of [-P, 0, P]) {
          const dx = Math.abs(x - (t.x + k)); if (dx > t.w) continue;
          const v = t.pine ? t.h * H * (1 - dx / t.w) : t.h * H * 0.55 + Math.sqrt(Math.max(0, t.w * t.w - dx * dx)) * 0.9;
          y = Math.max(y, base(t.x + k) + v);
        }
        return y;
      });
    }
    if (l.kind === 'city') {
      // buildings side by side over one period, repeated: flat tops, some taller towers and aerials
      const blds = []; let x = -P / 2;
      while (x < P / 2 - d * 0.01) { const w = Math.min(P / 2 - x, d * (0.025 + 0.04 * r())), h = d * H * (0.04 + (r() < 0.2 ? 0.16 : 0.08) * r()); blds.push({ x, w, h, aerial: r() < 0.15 }); x += w; }
      const out = [];
      [-P, 0, P].forEach((k) => blds.forEach((b) => {
        out.push([b.x + k, b.h]);
        if (b.aerial) { const m = b.x + k + b.w / 2, aw = Math.max(0.05, d * 0.002); out.push([m - aw, b.h], [m - aw, b.h + d * 0.03], [m + aw, b.h + d * 0.03], [m + aw, b.h]); }
        out.push([b.x + b.w + k, b.h]);
      }));
      out.blds = blds; return out;
    }
    return at(() => 0);
  }
  // a filled outline from the top edge down below the ground (so no gap shows under far layers)
  function groundShape(pts, bottom) {
    const sh = new T.Shape(); sh.moveTo(pts[0][0], bottom);
    pts.forEach(([x, y]) => sh.lineTo(x, y));
    sh.lineTo(pts[pts.length - 1][0], bottom); sh.closePath();
    return sh;
  }
  // a thin band just under the top edge (the light catching the edge, for the Classic emboss)
  function edgeBand(pts, w) {
    const sh = new T.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([x, y]) => sh.lineTo(x, y));
    for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1] - w);
    sh.closePath();
    return sh;
  }
  // clouds: groups of puffs, placed over one period and repeated
  function cloudPuffs(l, P, d) {
    const r = rng(l.seed), H = l.height ?? 1, n = 4 + Math.floor(r() * 4), clouds = [];
    for (let i = 0; i < n; i++) {
      const cx = (i + r() * 0.7) * (P / n) - P / 2, cy = d * (0.2 + 0.16 * r()) * H, size = d * (0.035 + 0.035 * r()), m = 4 + Math.floor(r() * 4), puffs = [];
      for (let k = 0; k < m; k++) { const u = k / (m - 1) - 0.5, pr = size * (0.55 + 0.45 * Math.cos(u * Math.PI) * (0.7 + 0.5 * r())); puffs.push([cx + u * size * 2.6, cy + pr * 0.35 * r(), pr]); }
      clouds.push(puffs);
    }
    const out = []; [-P, 0, P].forEach((k) => clouds.forEach((c) => out.push(c.map(([x, y, pr]) => [x + k, y, pr])))); return out;
  }

  // ---------------------------------------------------------------- building the layers
  const mat = (color, o = {}) => new T.MeshStandardMaterial({ color: new T.Color(color), roughness: o.rough ?? 1, metalness: 0, emissive: new T.Color(color), emissiveIntensity: o.glow ?? 0.4, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null, side: o.side ?? T.FrontSide });
  const mesh = (geo, m, z = 0) => { const x = new T.Mesh(geo, m); x.position.z = z; x.castShadow = false; x.receiveShadow = false; return x; };
  const merge = (list) => (list.length ? T.BufferGeometryUtils.mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false) : null);
  function colourOf(l, P, d) {
    if (l.color) return new T.Color(l.color);
    const base = new T.Color(P[l.kind] || '#888888'), f = (0.04 + 0.46 * Math.max(0, Math.min(1, (d - BD.NEAR) / (BD.FAR - BD.NEAR)))) * (l.haze ?? 1);
    return base.lerp(new T.Color(P.haze), l.kind === 'sun' || l.kind === 'stars' ? 0 : f);
  }
  function buildLayer(l, bd, d) {
    const g = new T.Group(), P = (BD.PALETTES[bd.palette] || BD.PALETTES.day)[1], per = periodOf(d), style = l.style || bd.style || 'classic';
    const col = colourOf(l, P, d), hex = '#' + col.getHexString(), light = '#' + col.clone().lerp(new T.Color('#ffffff'), 0.35).getHexString(), dark = '#' + col.clone().lerp(new T.Color('#000000'), 0.55).getHexString();
    const bottom = -0.3 * d;
    g.userData = { layer: l.id, period: per, dist: d };
    if (['hills', 'mountains', 'sea', 'trees', 'city'].includes(l.kind)) {
      const pts = skyline(l, per, d), sh = groundShape(pts, bottom);
      if (style === 'cardboard') { cardboard(g, [sh], col, d, per, pts, null, bd.stands !== false); }
      else if (style === 'modern') {
        const depth = d * 0.03, bev = Math.min(d * 0.02, 1.2);
        const geo = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: l.kind === 'city' ? bev * 0.25 : bev, bevelSegments: l.kind === 'city' ? 2 : 5, curveSegments: 4, steps: 1 });
        g.add(mesh(geo, new T.MeshStandardMaterial({ color: col, roughness: l.kind === 'sea' ? 0.25 : 0.9, metalness: 0 }), -depth / 2));
      } else {
        g.add(mesh(new T.ShapeGeometry(sh), mat(hex)));
        if (l.kind !== 'city') g.add(mesh(new T.ShapeGeometry(edgeBand(pts, d * (l.kind === 'sea' ? 0.004 : 0.008))), mat(light), 0.02));
        const shadow = mesh(new T.ShapeGeometry(sh), mat(dark, { opacity: 0.35 }), -0.15); shadow.position.x = d * 0.006; shadow.position.y = -d * 0.008; g.add(shadow);
      }
      if (l.kind === 'city' && pts.blds) {
        // windows: lit at sunset and at night
        const r = rng(l.seed + 7), quads = [], ws = d * 0.006, zf = style === 'modern' ? d * 0.015 + Math.min(d * 0.02, 1.2) + 0.02 : 0.03;
        [-per, 0, per].forEach((k) => pts.blds.forEach((b) => {
          for (let y = d * 0.012; y < b.h - d * 0.01; y += ws * 2.4) for (let x = b.x + ws * 1.2; x < b.x + b.w - ws * 1.2; x += ws * 2.2) if (r() < (P.lit ? 0.45 : 0.7)) { const q = new T.PlaneGeometry(ws, ws * 1.3); q.translate(x + k + ws / 2, y, zf); quads.push(q); }
        }));
        const wg = merge(quads); if (wg) g.add(mesh(wg, P.lit ? new T.MeshBasicMaterial({ color: P.windows }) : mat(P.windows, { glow: 0.1, rough: 0.3 })));
      }
    } else if (l.kind === 'clouds') {
      const puffs = cloudPuffs(l, per, d);
      if (style === 'cardboard') {
        const shapes = []; puffs.forEach((c) => c.forEach(([x, y, r]) => shapes.push(new T.Shape().absarc(x, y, r, 0, Math.PI * 2, false))));
        cardboard(g, shapes, col, d, per, null, puffs, bd.stands !== false);
      } else if (style === 'modern') {
        const list = []; puffs.forEach((c) => c.forEach(([x, y, r]) => { const s = new T.IcosahedronGeometry(r, 3); s.scale(1, 0.72, 0.6); s.translate(x, y, 0); list.push(s); }));
        g.add(mesh(merge(list), new T.MeshStandardMaterial({ color: col, roughness: 1, emissive: col, emissiveIntensity: 0.15 })));
      } else {
        const list = [], hi = []; puffs.forEach((c) => c.forEach(([x, y, r]) => { list.push(new T.CircleGeometry(r, 40).translate(x, y, 0)); hi.push(new T.CircleGeometry(r * 0.7, 32).translate(x - r * 0.15, y + r * 0.18, 0)); }));
        const body = merge(list); g.add(mesh(body, mat(hex, { glow: 0.55 })));
        g.add(mesh(merge(hi), mat(light, { glow: 0.6 }), 0.02));
        const shadow = mesh(body.clone(), mat(dark, { opacity: 0.3 }), -0.15); shadow.position.set(d * 0.006, -d * 0.008, -0.15); g.add(shadow);
      }
    } else if (['islands', 'playground', 'circuit', 'pixels', 'birds', 'balloons', 'rainbow', 'planets'].includes(l.kind)) {
      buildItems(g, makeItems(l, per, d, P, col), style, d, per, col, l, bd);
    } else if (l.kind === 'picture') {
      buildPicture(g, l, d, per, style, bd);
    } else if (l.kind === 'stars') {
      const r = rng(l.seed), list = [], n = Math.round(per * 1.4);
      for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) { const rr = d * (0.0015 + 0.003 * r() ** 3); list.push(new T.CircleGeometry(rr, 6).translate((r() - 0.5) * per + k * per, d * (0.06 + 0.55 * r()) * (l.height ?? 1), 0)); }
      g.add(mesh(merge(list), new T.MeshBasicMaterial({ color: col })));
    } else if (l.kind === 'sun') {
      const r = rng(l.seed), x = (r() - 0.5) * per * 0.5, y = d * (0.16 + 0.14 * r()) * (l.height ?? 1), rad = d * 0.045;
      const moon = bd.palette === 'night';
      if (style === 'modern') g.add(mesh(new T.SphereGeometry(rad, 40, 24).translate(x, y, 0), new T.MeshBasicMaterial({ color: col })));
      else g.add(mesh(new T.CircleGeometry(rad, 64).translate(x, y, 0), new T.MeshBasicMaterial({ color: col })));
      if (bd.palette === 'digital') { const bars = []; for (let i = 0; i < 5; i++) { const h = rad * (0.06 + i * 0.035), yy = y - rad * (0.15 + i * 0.18); bars.push(new T.PlaneGeometry(rad * 2.2, h).translate(x, yy, 0)); } g.add(mesh(merge(bars), new T.MeshBasicMaterial({ color: new T.Color(P.sky[1]) }), style === 'modern' ? rad + 0.05 : 0.02)); }
      if (moon) { const bite = mesh(new T.CircleGeometry(rad * 0.92, 64).translate(x + rad * 0.45, y + rad * 0.2, 0), new T.MeshBasicMaterial({ color: new T.Color(P.sky[0]) }), style === 'modern' ? rad + 0.05 : 0.02); g.add(bite); }
      else g.add(mesh(new T.CircleGeometry(rad * 1.9, 64).translate(x, y, 0), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false }), -0.05));
    }
    g.traverse((x) => { x.userData.backdrop = true; });
    return g;
  }

  // Cardboard: the cut-out has a little thickness with plain brown cardboard edges and back, and fold-out easel stands
  // (a triangle of card, hinged at the back) prop it up every so often along it. Clouds are held up on sticks.
  const CARD = '#b48a58';
  function cardboard(g, shapes, col, d, per, pts, puffs, withStands = true) {
    const t = Math.max(0.08, d * 0.004);
    const geo = new T.ExtrudeGeometry(shapes, { depth: t, bevelEnabled: false, curveSegments: 24 });
    // ExtrudeGeometry has the faces (front and back) as group 0 and the cut edges as group 1
    const front = new T.MeshStandardMaterial({ color: col, roughness: 0.95, emissive: col, emissiveIntensity: 0.3 }), edge = new T.MeshStandardMaterial({ color: CARD, roughness: 1 });
    g.add(mesh(geo, [front, edge], -t / 2));
    if (!withStands) return;
    // where the stands go and how tall: along the ground layers every so often; under each cloud
    const spots = [];
    if (pts) { const n = Math.max(2, Math.round(per / (d * 0.18))); for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) { const x = k * per + (i + 0.5) * (per / n) - per / 2, near = pts.reduce((a, p) => (Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a), pts[0]); spots.push([x, Math.max(d * 0.02, near[1] * 0.7), 0]); } }
    const stands = [];
    spots.forEach(([x, h]) => {
      const tri = new T.Shape().moveTo(0, 0).lineTo(h * 0.45, 0).lineTo(0, h).closePath(), s = new T.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false });
      s.rotateY(Math.PI / 2); s.translate(x - t / 2, 0, -t / 2); stands.push(s);
    });
    if (puffs) puffs.forEach((c) => {
      const xs = c.map((p) => p[0]), low = Math.min(...c.map((p) => p[1])), x = (Math.min(...xs) + Math.max(...xs)) / 2, stick = new T.BoxGeometry(t * 1.5, low + d * 0.3, t * 1.5);
      stick.translate(x, (low - d * 0.3) / 2, -t * 1.5); stands.push(stick);
    });
    if (stands.length) g.add(mesh(merge(stands.map((s) => { const n = s.index ? s.toNonIndexed() : s; n.clearGroups(); return n; })), new T.MeshStandardMaterial({ color: CARD, roughness: 1 })));
  }

  // ---------------------------------------------------------------- layers made of separate pieces
  // a bar from (x1, y1) to (x2, y2), w wide, as a flat shape
  function bar(x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2, sh = new T.Shape();
    sh.moveTo(x1 + nx, y1 + ny); sh.lineTo(x2 + nx, y2 + ny); sh.lineTo(x2 - nx, y2 - ny); sh.lineTo(x1 - nx, y1 - ny); sh.closePath(); return sh;
  }
  const rect = (x, y, w, h) => { const sh = new T.Shape(); sh.moveTo(x, y); sh.lineTo(x + w, y); sh.lineTo(x + w, y + h); sh.lineTo(x, y + h); sh.closePath(); return sh; };
  const disc = (x, y, r) => new T.Shape().absarc(x, y, r, 0, Math.PI * 2, false);
  const BRIGHT = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#ae3ec9', '#f76707', '#0ca678'];
  // pieces: [{ shapes, color, glow, sky }] over one period, repeated three times; sky pieces get sticks in Cardboard
  function makeItems(l, P, d, Pal, col) {
    const r = rng(l.seed), H = l.height ?? 1, items = [], one = [];
    const add = (shapes, color, o = {}) => one.push({ shapes: [].concat(shapes), color: new T.Color(color), ...o });
    if (l.kind === 'islands') {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.2 + r() * 0.6) * (P / n) - P / 2, w = d * (0.14 + 0.16 * r()), h = d * H * (0.035 + 0.04 * r());
        const hump = (k) => { const sh = new T.Shape(); sh.moveTo(cx - w * k, -d * 0.05); for (let j = 0; j <= 24; j++) { const u = j / 24, x = cx - w * k + 2 * w * k * u; sh.lineTo(x, h * k * Math.sin(u * Math.PI) ** 0.7); } sh.lineTo(cx + w * k, -d * 0.05); sh.closePath(); return sh; };
        add(hump(1), Pal.sand || '#e9d29a'); add(hump(0.78), col, { z: 0.03 });
        // a palm or two on top
        for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
          const px = cx + (r() - 0.5) * w * 0.8, base = h * 0.7, th = d * (0.06 + 0.035 * r()), lean = (r() - 0.5) * th * 0.5, tx = px + lean, ty = base + th;
          add(bar(px, base * 0.8, tx, ty, d * 0.007), '#7a5230', { z: 0.05 });
          const leaves = []; for (let a = 0; a < 6; a++) { const ang = Math.PI * (0.05 + a * 0.18), lx = tx + Math.cos(ang) * th * 0.45, ly = ty + Math.sin(ang) * th * 0.2 - th * 0.08; leaves.push(bar(tx, ty, lx, ly, d * 0.011)); }
          add(leaves, '#2f7a3a', { z: 0.06 });
        }
      }
    } else if (l.kind === 'playground') {
      // swings, a slide, a climbing frame and a seesaw, with a fence running along
      const things = ['swing', 'slide', 'dome', 'seesaw'], n = 3 + Math.floor(r() * 2), u = d * 0.028 * H;
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * (P / n) - P / 2 + (r() - 0.5) * P / n * 0.3, kind = things[(i + Math.floor(r() * 4)) % 4], c1 = BRIGHT[Math.floor(r() * BRIGHT.length)], c2 = BRIGHT[Math.floor(r() * BRIGHT.length)], frame = col;
        if (kind === 'swing') { const w = u * 9, h = u * 6, t = u * 0.35; add([bar(cx - w / 2, 0, cx - w / 2 + u, h, t), bar(cx - w / 2 + u * 2, 0, cx - w / 2 + u, h, t), bar(cx + w / 2, 0, cx + w / 2 - u, h, t), bar(cx + w / 2 - u * 2, 0, cx + w / 2 - u, h, t), bar(cx - w / 2 + u, h, cx + w / 2 - u, h, t * 1.2)], frame); [-1, 1].forEach((sgn) => { const sx = cx + sgn * w * 0.18; add([bar(sx - u * 0.6, h, sx - u * 0.6, u * 1.6, t * 0.4), bar(sx + u * 0.6, h, sx + u * 0.6, u * 1.6, t * 0.4)], '#555555', { z: 0.01 }); add(rect(sx - u * 0.9, u * 1.4, u * 1.8, u * 0.35), sgn < 0 ? c1 : c2, { z: 0.02 }); }); }
        if (kind === 'slide') { const h = u * 5, t = u * 0.35; add([bar(cx - u * 4, 0, cx - u * 4, h, t), bar(cx - u * 2.5, 0, cx - u * 2.5, h, t), ...[1, 2, 3, 4].map((k) => bar(cx - u * 4, k * h / 5, cx - u * 2.5, k * h / 5, t * 0.7)), rect(cx - u * 4.2, h, u * 2.2, u * 0.4)], frame); add(bar(cx - u * 2.2, h, cx + u * 4, u * 0.3, u * 0.9), c1, { z: 0.02 }); }
        if (kind === 'dome') { const R = u * 4, t = u * 0.3, arcs = []; for (let k = 1; k <= 3; k++) { const rr = R * k / 3, steps = 18; for (let j = 0; j < steps; j++) { const a0 = Math.PI * j / steps, a1 = Math.PI * (j + 1) / steps; arcs.push(bar(cx + Math.cos(a0) * rr, Math.sin(a0) * R, cx + Math.cos(a1) * rr, Math.sin(a1) * R, t)); } } for (let k = 1; k < 4; k++) arcs.push(bar(cx - R * Math.sqrt(1 - (k / 4) ** 2), R * k / 4, cx + R * Math.sqrt(1 - (k / 4) ** 2), R * k / 4, t)); add(arcs, c2); }
        if (kind === 'seesaw') { const tri = new T.Shape(); tri.moveTo(cx - u, 0); tri.lineTo(cx + u, 0); tri.lineTo(cx, u * 1.4); tri.closePath(); add(tri, frame); const tilt = (r() - 0.5) * u * 2.5; add(bar(cx - u * 5, u * 1.4 - tilt, cx + u * 5, u * 1.4 + tilt, u * 0.5), c1, { z: 0.02 }); }
      }
      const fence = [], fy = u * 2.2; for (let x = -P / 2; x < P / 2; x += u * 3) fence.push(rect(x, 0, u * 0.35, fy));
      fence.push(rect(-P / 2, fy * 0.35, P, u * 0.25), rect(-P / 2, fy * 0.8, P, u * 0.25));
      add(fence, '#ffffff', { z: 0.08 });
    } else if (l.kind === 'circuit') {
      // a board edge with chips on it, pins down their sides, and glowing traces running up and across
      const base = d * 0.012; add(rect(-P / 2, -d * 0.05, P, base + d * 0.05), col);
      let x = -P / 2 + d * 0.02;
      while (x < P / 2 - d * 0.06) {
        const w = d * (0.025 + 0.05 * r()), h = d * H * (0.02 + 0.06 * r()), pins = [];
        add(rect(x, base, w, h), '#1e2a33', { z: 0.01 });
        for (let py = base + h * 0.15; py < base + h * 0.9; py += d * 0.007) pins.push(rect(x - d * 0.004, py, d * 0.004, d * 0.003), rect(x + w, py, d * 0.004, d * 0.003));
        add(pins, '#c0c7cf', { z: 0.01 });
        // traces: up from the chip, then along, ending in a dot
        const tr = [], tw = d * 0.0022, top = base + h; let tx = x + w * (0.2 + 0.6 * r()), ty = top;
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) { const up = d * H * (0.02 + 0.05 * r()), side = (r() - 0.5) * d * 0.12; tr.push(bar(tx, ty, tx, ty + up, tw)); ty += up; tr.push(bar(tx, ty, tx + side, ty, tw)); tx += side; }
        tr.push(disc(tx, ty, tw * 2.2));
        add(tr, Pal.traces || '#39ff88', { z: 0.02, glow: true });
        x += w + d * (0.02 + 0.05 * r());
      }
    } else if (l.kind === 'pixels') {
      const n = Math.round(P * 0.4);
      for (let i = 0; i < n; i++) { const s = d * (0.006 + 0.018 * r() ** 2), c = [Pal.pixels || '#22d3ee', Pal.traces || '#39ff88', '#ff4fd8', '#ffffff'][Math.floor(r() * 4)]; add(rect((r() - 0.5) * P, d * (0.08 + 0.45 * r()) * H, s, s), c, { glow: true, sky: true }); }
    } else if (l.kind === 'birds') {
      const flocks = 1 + Math.floor(r() * 3);
      for (let f = 0; f < flocks; f++) { const fx = (r() - 0.5) * P, fy = d * (0.18 + 0.2 * r()) * H, n = 3 + Math.floor(r() * 7), wings = []; for (let i = 0; i < n; i++) { const bx = fx + (r() - 0.5) * d * 0.25, by = fy + (r() - 0.5) * d * 0.09, w = d * (0.018 + 0.012 * r()), dip = w * (0.2 + 0.3 * r()); wings.push(bar(bx - w, by + w * 0.35, bx, by - dip * 0.2, w * 0.18), bar(bx, by - dip * 0.2, bx + w, by + w * 0.35, w * 0.18)); } add(wings, col, { sky: true }); }
    } else if (l.kind === 'balloons') {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const bx = (i + 0.2 + r() * 0.6) * (P / n) - P / 2, by = d * (0.14 + 0.2 * r()) * H, R = d * (0.035 + 0.025 * r()), c = BRIGHT[Math.floor(r() * BRIGHT.length)];
        const env = new T.Shape(); env.moveTo(bx, by - R * 1.45); env.bezierCurveTo(bx - R * 0.5, by - R * 1.1, bx - R * 1.15, by - R * 0.4, bx - R, by + R * 0.2); env.absarc(bx, by + R * 0.2, R, Math.PI, 0, true); env.bezierCurveTo(bx + R * 1.15, by - R * 0.4, bx + R * 0.5, by - R * 1.1, bx, by - R * 1.45);
        add(env, c, { sky: true });
        const stripe = new T.Shape(); stripe.moveTo(bx, by - R * 1.4); stripe.bezierCurveTo(bx - R * 0.45, by - R * 0.6, bx - R * 0.45, by + R * 0.8, bx, by + R * 1.2); stripe.bezierCurveTo(bx + R * 0.45, by + R * 0.8, bx + R * 0.45, by - R * 0.6, bx, by - R * 1.4);
        add(stripe, BRIGHT[(BRIGHT.indexOf(c) + 2) % BRIGHT.length], { z: 0.02, sky: true });
        add([bar(bx - R * 0.35, by - R * 1.4, bx - R * 0.25, by - R * 1.9, R * 0.04), bar(bx + R * 0.35, by - R * 1.4, bx + R * 0.25, by - R * 1.9, R * 0.04), rect(bx - R * 0.3, by - R * 2.15, R * 0.6, R * 0.3)], '#6b4a2b', { z: 0.01, sky: true });
      }
    } else if (l.kind === 'rainbow') {
      const cx = (r() - 0.5) * P * 0.3, R = d * 0.3 * H, band = d * 0.012, cols = ['#e03131', '#f76707', '#fcc419', '#40c057', '#228be6', '#7048e8'];
      cols.forEach((c, i) => { const ro = R - i * band, ri = ro - band, sh = new T.Shape(); sh.absarc(cx, -d * 0.02, ro, 0, Math.PI, false); sh.absarc(cx, -d * 0.02, ri, Math.PI, 0, true); sh.closePath(); add(sh, c, { glow: true, sky: true, z: 0.002 * i, once: true }); });
    } else if (l.kind === 'planets') {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const px = (r() - 0.5) * P * 0.6, py = d * (0.15 + 0.25 * r()) * H, R = d * (0.04 + 0.07 * r()) * (i ? 0.5 : 1), c = ['#e599f7', '#74c0fc', '#ffa94d', '#ced4da', '#ff8787'][Math.floor(r() * 5)];
        add(disc(px, py, R), c, { sky: true, once: true });
        if (r() < 0.6) { const ring = new T.Shape(); ring.absellipse(px, py, R * 2, R * 0.45, 0, Math.PI * 2, false, -0.3); ring.holes.push(new T.Path().absellipse(px, py, R * 1.45, R * 0.3, 0, Math.PI * 2, true, -0.3)); add(ring, '#f1f3f5', { sky: true, once: true, z: 0.02 }); }
      }
    }
    // repeat over three periods (things that should appear only once, like a rainbow, stay once)
    one.forEach((it) => { if (it.once) items.push(it); else [-P, 0, P].forEach((k) => items.push({ ...it, shapes: it.shapes.map((sh) => moveShape(sh, k)) })); });
    return items;
  }
  const moveShape = (sh, dx) => { if (!dx) return sh; const g = new T.Shape(sh.getPoints(24).map((p) => new T.Vector2(p.x + dx, p.y))); g.holes = sh.holes.map((h) => new T.Path(h.getPoints(24).map((p) => new T.Vector2(p.x + dx, p.y)))); return g; };
  // pieces in the chosen style: Classic (flat, a drop shadow behind), Modern (rounded 3D), Cardboard (cut-outs, stands or sticks)
  function buildItems(g, items, style, d, per, col, l, bd) {
    const P = (BD.PALETTES[bd.palette] || BD.PALETTES.day)[1], haze = new T.Color(P.haze), f = (0.04 + 0.46 * Math.max(0, Math.min(1, (d - BD.NEAR) / (BD.FAR - BD.NEAR)))) * (l.haze ?? 1);
    const groups = new Map(); // one mesh per colour and depth
    items.forEach((it) => { const c = it.glow ? it.color : it.color.clone().lerp(haze, f), key = c.getHexString() + '|' + (it.z || 0) + '|' + !!it.glow; if (!groups.has(key)) groups.set(key, { c, z: it.z || 0, glow: it.glow, shapes: [] }); groups.get(key).shapes.push(...it.shapes); });
    const shadowShapes = [];
    groups.forEach(({ c, z, glow, shapes }) => {
      if (style === 'modern' && !glow) {
        const depth = d * 0.008, bev = Math.min(d * 0.004, 0.4);
        const geo = new T.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.5, bevelSegments: 3, curveSegments: 12 });
        g.add(mesh(geo, new T.MeshStandardMaterial({ color: c, roughness: 0.6 }), z * 6 - depth / 2));
      } else if (style === 'cardboard' && !glow) {
        const t = Math.max(0.06, d * 0.003), geo = new T.ExtrudeGeometry(shapes, { depth: t, bevelEnabled: false, curveSegments: 12 });
        g.add(mesh(geo, [new T.MeshStandardMaterial({ color: c, roughness: 0.95, emissive: c, emissiveIntensity: 0.3 }), new T.MeshStandardMaterial({ color: CARD, roughness: 1 })], z * 4 - t / 2));
      } else {
        g.add(mesh(new T.ShapeGeometry(shapes, 12), glow ? new T.MeshBasicMaterial({ color: c }) : mat('#' + c.getHexString()), z));
        if (!glow) shadowShapes.push(...shapes);
      }
    });
    if (style === 'classic' && shadowShapes.length) { const dark = '#' + col.clone().lerp(new T.Color('#000000'), 0.55).getHexString(), sh = mesh(new T.ShapeGeometry(shadowShapes, 12), mat(dark, { opacity: 0.3 }), -0.15); sh.position.set(d * 0.005, -d * 0.006, -0.15); g.add(sh); }
    if (style === 'cardboard' && bd.stands !== false) {
      // sky pieces on sticks; ground pieces on little stands
      const t = Math.max(0.06, d * 0.003), stands = [];
      items.forEach((it) => {
        const pts = it.shapes.flatMap((sh) => sh.getPoints(8)); if (!pts.length) return;
        const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y)), x = (minX + maxX) / 2;
        if (it.sky) { if (it.z) return; const st = new T.BoxGeometry(t * 1.5, minY + d * 0.3, t * 1.5); st.translate(x, (minY - d * 0.3) / 2, -t * 1.5); stands.push(st); }
        else if (!it.z && maxY - minY > d * 0.01 && maxX - minX < per * 0.5) { const h = (maxY - Math.max(0, minY)) * 0.7, tri = new T.Shape().moveTo(0, 0).lineTo(h * 0.45, 0).lineTo(0, h).closePath(), s2 = new T.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false }); s2.rotateY(Math.PI / 2); s2.translate(x - t / 2, Math.max(0, minY), -t / 2); stands.push(s2); }
      });
      if (stands.length) g.add(mesh(merge(stands.map((s2) => { const n = s2.index ? s2.toNonIndexed() : s2; n.clearGroups(); return n; })), new T.MeshStandardMaterial({ color: CARD, roughness: 1 })));
    }
  }

  // ---------------------------------------------------------------- your own picture as a cut-out layer
  // The picture is cut out by its see-through parts (or a plain background taken from its corners), then drawn with a
  // drop shadow, an optional white die-cut border and an embossed edge, on a flat card; it can repeat along the layer.
  const pictureCache = new Map();
  function cutout(img, o) {
    const key = img.src.length + '|' + img.src.slice(-64) + JSON.stringify(o); if (pictureCache.has(key)) return pictureCache.get(key);
    const S = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * S), h = Math.round(img.naturalHeight * S), pad = Math.round(Math.max(w, h) * 0.07);
    const W = w + pad * 2, H = h + pad * 2, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const pic = mk(), px = pic.getContext('2d'); px.drawImage(img, pad, pad, w, h);
    if (o.removeBg) {
      // the colour in the corners is the background: make it (and colours close to it) see-through
      const id = px.getImageData(0, 0, W, H), D = id.data, at = (x, y) => (y * W + x) * 4, corners = [at(pad, pad), at(pad + w - 1, pad), at(pad, pad + h - 1), at(pad + w - 1, pad + h - 1)];
      const bg = [0, 1, 2].map((k) => corners.reduce((s2, i) => s2 + D[i + k], 0) / 4), cornerAlpha = corners.reduce((s2, i) => s2 + D[i + 3], 0) / 4;
      if (cornerAlpha > 200) for (let i = 0; i < D.length; i += 4) { const dist = Math.hypot(D[i] - bg[0], D[i + 1] - bg[1], D[i + 2] - bg[2]); if (dist < 40) D[i + 3] = 0; else if (dist < 70) D[i + 3] = Math.min(D[i + 3], ((dist - 40) / 30) * 255); }
      px.putImageData(id, 0, 0);
    }
    // the shape alone (white where the picture is)
    const mask = mk(), mx = mask.getContext('2d'); mx.drawImage(pic, 0, 0); mx.globalCompositeOperation = 'source-in'; mx.fillStyle = '#ffffff'; mx.fillRect(0, 0, W, H);
    const out = mk(), ox = out.getContext('2d'), bw = Math.round(Math.max(w, h) * 0.018);
    let shape = mask;
    if (o.border) { const b = mk(), bx = b.getContext('2d'); for (let a = 0; a < 16; a++) bx.drawImage(mask, Math.cos(a / 16 * Math.PI * 2) * bw, Math.sin(a / 16 * Math.PI * 2) * bw); shape = b; }
    // drop shadow
    ox.save(); ox.filter = `blur(${Math.round(bw * 1.2)}px)`; ox.globalAlpha = 0.4; ox.drawImage(shape, bw * 0.8, bw * 1.1); ox.restore();
    ox.save(); ox.globalCompositeOperation = 'source-atop'; ox.fillStyle = '#000000'; ox.globalAlpha = 0.6; ox.fillRect(0, 0, W, H); ox.restore();
    if (o.border) ox.drawImage(shape, 0, 0);
    ox.drawImage(pic, 0, 0);
    // embossed edge: light from the top left, from the slope of a blurred copy of the shape
    if (o.emboss > 0) {
      const hm = mk(), hx = hm.getContext('2d'); hx.filter = `blur(${Math.max(2, Math.round(bw * 0.8))}px)`; hx.drawImage(shape, 0, 0);
      const H1 = hx.getImageData(0, 0, W, H).data, sd = ox.getImageData(0, 0, W, H), Dd = sd.data, step = Math.max(1, Math.round(bw * 0.4)), k = 1.4 * o.emboss;
      for (let y = step; y < H - step; y++) for (let x = step; x < W - step; x++) {
        const i = (y * W + x) * 4; if (Dd[i + 3] < 10) continue;
        const sl = (H1[((y - step) * W + (x - step)) * 4 + 3] - H1[((y + step) * W + (x + step)) * 4 + 3]) * k;
        for (let c = 0; c < 3; c++) Dd[i + c] = Math.max(0, Math.min(255, Dd[i + c] + sl));
      }
      ox.putImageData(sd, 0, 0);
    }
    const res = { canvas: out, aspect: W / H };
    pictureCache.set(key, res); return res;
  }
  function buildPicture(g, l, d, per, style, bd) {
    if (!l.src) return;
    const w = d * 0.35 * (l.size || 1), img = new Image(), n = Math.max(0, l.repeat | 0);
    const tex = new T.CanvasTexture(document.createElement('canvas')); tex.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, roughness: 0.9, emissive: new T.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.35, side: T.DoubleSide });
    const aspect = l.aspect || 1, h = w / aspect, xs = [];
    if (n <= 0) xs.push(0); else for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) xs.push(k * per + (i + 0.5) * (per / n) - per / 2);
    const geos = xs.map((x) => new T.PlaneGeometry(w, h).translate(x, h / 2 - h * 0.07, 0)), card = mesh(merge(geos), material);
    g.add(card);
    if (style === 'cardboard' && bd.stands !== false) { const t = Math.max(0.06, d * 0.003), stands = xs.map((x) => { const hh = h * 0.6, tri = new T.Shape().moveTo(0, 0).lineTo(hh * 0.45, 0).lineTo(0, hh).closePath(), s2 = new T.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false }); s2.rotateY(Math.PI / 2); s2.translate(x - t / 2, 0, -t / 2); const nn = s2.index ? s2.toNonIndexed() : s2; nn.clearGroups(); return nn; }); g.add(mesh(merge(stands), new T.MeshStandardMaterial({ color: CARD, roughness: 1 }), -0.02)); }
    img.onload = () => { const c = cutout(img, { removeBg: l.removeBg !== false, border: l.border !== false, emboss: style === 'modern' ? 1.6 * (l.emboss ?? 1) : (l.emboss ?? 1) }); const t2 = new T.CanvasTexture(c.canvas); t2.colorSpace = T.SRGBColorSpace; material.map = material.emissiveMap = t2; material.needsUpdate = true; tex.dispose(); E.redraw && E.redraw(); };
    img.src = l.src;
  }

  // ---------------------------------------------------------------- in the scene
  let group = null, built = '', center = new T.Vector3();
  BD.sync = function (force) {
    const scene = E.scene && E.scene(); if (!scene) return;
    const bd = BD.get(), sig = bd ? JSON.stringify(bd) : '';
    if (!force && sig === built && group) { BD.pose(E.time); return; }
    built = sig;
    if (group) { group.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); [].concat(x.material).forEach((m) => m.dispose()); } }); scene.remove(group); group = null; }
    if (!bd || !bd.on) { E.redraw && E.redraw(); return; }
    group = new T.Group(); group.name = 'backdrop';
    const n = bd.layers.length;
    bd.layers.forEach((l, i) => { if (l.visible === false) return; const d = BD.distOf(i, n), g = buildLayer(l, bd, d); g.position.z = -d; group.add(g); });
    const box = new T.Box3().setFromObject(E.root()); center = box.isEmpty() ? new T.Vector3() : box.getCenter(new T.Vector3()); center.y = 0;
    scene.add(group);
    BD.pose(E.time);
  };
  const ease = (x) => 1 - (1 - x) ** 3;
  // where each layer is at time t: scrolling, bobbing, and its entrance and exit
  BD.pose = function (t) {
    const bd = BD.get(); if (!group || !bd) return;
    group.children.forEach((g) => {
      const l = bd.layers.find((x) => x.id === g.userData.layer); if (!l) return;
      const per = g.userData.period, d = g.userData.dist;
      // like the old games, the depth effect is stronger than true distance: the front layer at full speed, the back at about 40%
      const off = (bd.speed || 0) * (BD.NEAR / d) ** 3 * (l.speed ?? 1) * t;
      let x = bd.mode === 'once' ? -off : -(((off + per / 2) % per) + per) % per + per / 2, y = (l.y || 0) + (bd.y || 0);
      if (l.bob) y += l.bob * d * 0.006 * Math.sin((t / 3) * Math.PI * 2 + (l.seed % 7));
      const inn = l.enter || {}, out = l.exit || {};
      if (inn.move && inn.move !== 'none') { const u = ease(Math.max(0, Math.min(1, (t - (inn.at || 0)) / Math.max(0.05, inn.dur || 1)))); if (inn.move === 'fly') y += (1 - u) * d * 0.6; else if (inn.move === 'rise') y -= (1 - u) * d * 0.5; else if (inn.move === 'slide') x += (1 - u) * per; }
      if (out.move && out.move !== 'none') { const u = Math.max(0, Math.min(1, (t - (out.at || 0)) / Math.max(0.05, out.dur || 1))), e = u * u * u; if (out.move === 'fly') y += e * d * 0.6; else if (out.move === 'rise') y -= e * d * 0.5; else if (out.move === 'slide') x -= e * per; }
      g.position.x = x; g.position.y = y;
    });
    face();
    E.redraw && E.redraw();
  };
  // the backdrop stands round the scene's centre, turned so it is behind it as seen from the camera
  function face() {
    if (!group) return;
    const v = E.mainView && E.mainView(); if (!v) return;
    const dir = v.cam.position.clone().sub(center); group.position.copy(center); group.rotation.y = Math.atan2(dir.x, dir.z);
  }
  BD.face = face;
  E.on('time', (t) => BD.pose(t));
  E.on('camera', () => { face(); });
  E.on('view', () => { face(); });
  E.on('built', () => BD.sync());
})();
