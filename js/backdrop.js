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
    traffic: ['Sky traffic (planes, ships, shooting stars)', { speed: 0, bob: 0, planes: 2, ships: 1, airships: 1, stars: 3 }],
    forest: ['Forest', { speed: 1, bob: 0, type: 'oak', density: 1 }],
    picture: ['Picture (your own)', { speed: 1, bob: 0, size: 1, repeat: 1, removeBg: true, border: true, emboss: 1 }],
  };
  // kinds that float in the sky (Cardboard holds them up on sticks)
  BD.SKY = ['clouds', 'pixels', 'birds', 'balloons', 'rainbow', 'planets', 'traffic'];
  // palettes: the sky (top, horizon), the haze far layers fade into, and a colour for each kind
  BD.PALETTES = {
    day: ['Day', { sky: ['#6fb0ee', '#e4f1fb'], haze: '#d6e7f5', sun: '#ffd84d', stars: '#ffffff', clouds: '#ffffff', mountains: '#7486a3', hills: '#64ad55', trees: '#2c7339', city: '#56677c', sea: '#2f86c8', windows: '#3a4a5c', lit: false, islands: '#3f9a4a', sand: '#e9d29a', playground: '#e03131', circuit: '#2f6b4f', traces: '#c9f2d8', pixels: '#4dabf7', birds: '#2b2f38', balloons: '#e8590c', rainbow: '#ffffff', planets: '#adb5bd' }],
    sunset: ['Sunset', { sky: ['#ff7a59', '#ffd59e'], haze: '#f7b48e', sun: '#fff0a0', stars: '#fff4e0', clouds: '#ffc0a4', mountains: '#7a4f74', hills: '#a3566b', trees: '#4b2e4f', city: '#3c2a46', sea: '#d9775c', windows: '#ffd27a', lit: true, islands: '#5a3d5c', sand: '#e7a77a', playground: '#c2255c', circuit: '#3a2846', traces: '#ffd27a', pixels: '#ffa94d', birds: '#2a1d2e', balloons: '#f76707', rainbow: '#ffffff', planets: '#e599f7' }],
    night: ['Night', { sky: ['#070b1e', '#22325e'], haze: '#273763', sun: '#eef1f6', stars: '#ffffff', clouds: '#56678a', mountains: '#1d2846', hills: '#18352f', trees: '#0e221e', city: '#141a2d', sea: '#13305a', windows: '#ffd86b', lit: true, islands: '#16302b', sand: '#3d4a6b', playground: '#5c7cfa', circuit: '#101a33', traces: '#66d9e8', pixels: '#74c0fc', birds: '#c5cee0', balloons: '#ffa94d', rainbow: '#ffffff', planets: '#d0bfff' }],
    desert: ['Desert', { sky: ['#f2b56b', '#fdebc8'], haze: '#f2d7ad', sun: '#fff3c4', stars: '#ffffff', clouds: '#fff6e8', mountains: '#b8704a', hills: '#e2a868', trees: '#6f8a35', city: '#a46f4c', sea: '#3fa7a0', windows: '#5a4030', lit: false, islands: '#8a9a3a', sand: '#efcf8f', playground: '#e8590c', circuit: '#7a5638', traces: '#ffe8a3', pixels: '#ffa94d', birds: '#4a3528', balloons: '#d9480f', rainbow: '#ffffff', planets: '#ffc078' }],
    storm: ['Storm', { sky: ['#343b4a', '#8b95a7'], haze: '#97a1b0', sun: '#d8dee9', stars: '#e5e9f0', clouds: '#6b7280', mountains: '#4b5563', hills: '#4c6848', trees: '#2b3b2a', city: '#384150', sea: '#3c596b', windows: '#cfd6e0', lit: false, islands: '#3d5a3a', sand: '#b8b09a', playground: '#868e96', circuit: '#36404d', traces: '#a5d8ff', pixels: '#91a7ff', birds: '#1f242c', balloons: '#868e96', rainbow: '#ffffff', planets: '#ced4da' }],
  };
  BD.PALETTES.digital = ['Digital', { sky: ['#04050d', '#13284a'], haze: '#163a5c', sun: '#ff4fd8', stars: '#7fffd4', clouds: '#1b4d6b', mountains: '#123c5a', hills: '#0e4d45', trees: '#0b3b3a', city: '#0c2238', sea: '#0a3a5c', windows: '#39ff14', lit: true, islands: '#0e4d45', sand: '#1b4d6b', playground: '#22d3ee', circuit: '#0d3b4f', traces: '#39ff88', pixels: '#22d3ee', birds: '#7fffd4', balloons: '#ff4fd8', rainbow: '#ffffff', planets: '#be4bdb' }];
  BD.PALETTES.jungle = ['Rainforest mist', { sky: ['#7fb9a6', '#e3efe0'], haze: '#c9dfcf', sun: '#fff6c8', stars: '#ffffff', clouds: '#f4f8f2', mountains: '#5d8a73', hills: '#3f8a4f', trees: '#1f6b3a', city: '#4a5d52', sea: '#2f7f7a', windows: '#3a4a40', lit: false, islands: '#2f7a3a', sand: '#d8c99a', playground: '#e03131', circuit: '#2f5b45', traces: '#c9f2d8', pixels: '#69db7c', birds: '#2b2f38', balloons: '#e8590c', rainbow: '#ffffff', planets: '#adb5bd', forest: '#1f6b3a' }];
  BD.FOREST_TYPES = { open: 'Open woodland (big trees, lots of space)', pine: 'Pine forest (USA)', oak: 'Woodland (UK oaks)', jungle: 'Rainforest (Amazon)', ferns: 'Ferns and undergrowth' };
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
    city: ['City', ['sun', 'traffic', 'clouds', 'city', ['city', { height: 0.8 }]], ['day', 'sunset', 'night']],
    seaside: ['Seaside', ['sun', ['traffic', { planes: 1, ships: 0, airships: 1, stars: 0 }], 'clouds', 'birds', 'mountains', 'sea'], ['day', 'sunset']],
    islands: ['Ocean and islands', ['sun', 'clouds', 'birds', 'islands', 'sea'], ['day', 'sunset', 'night']],
    desert: ['Desert', ['sun', 'mountains', 'hills', ['hills', { height: 0.7 }]], ['desert']],
    nightcity: ['Night city', ['stars', 'sun', ['traffic', { planes: 1, ships: 1, airships: 0, stars: 4 }], 'city', ['city', { height: 0.8 }]], ['night']],
    playground: ['Playground', ['sun', 'clouds', 'balloons', 'trees', 'playground'], ['day', 'sunset']],
    computer: ['Computer', ['pixels', 'sun', ['circuit', { height: 1.4 }], 'circuit'], ['digital']],
    rainbow: ['Rainbow meadow', ['rainbow', 'clouds', 'hills', 'trees'], ['day']],
    balloons: ['Balloon festival', ['sun', 'clouds', 'balloons', 'hills', ['balloons', { height: 0.6 }]], ['day', 'sunset']],
    meadow: ['Open woodland', ['sun', 'clouds', 'mountains', ['forest', { type: 'pine', height: 0.6, density: 1.4 }], ['forest', { type: 'open' }]], ['day', 'sunset']],
    pineforest: ['Pine forest (USA)', ['sun', 'clouds', 'mountains', ['forest', { type: 'pine', height: 0.75 }], ['forest', { type: 'pine' }], ['forest', { type: 'pine', height: 1.3, density: 0.7 }]], ['day', 'sunset', 'storm']],
    woodland: ['Woodland (UK)', ['sun', 'clouds', 'hills', ['forest', { type: 'oak', height: 0.8 }], ['forest', { type: 'oak', height: 1.2, density: 0.8 }]], ['day', 'sunset', 'storm']],
    rainforest: ['Rainforest (Amazon)', ['sun', 'clouds', 'birds', ['forest', { type: 'jungle', height: 0.85 }], ['forest', { type: 'jungle', height: 1.2 }], ['forest', { type: 'ferns' }]], ['jungle']],
    space: ['Space', ['stars', ['traffic', { planes: 0, ships: 2, airships: 0, stars: 5 }], 'planets', 'mountains', ['hills', { height: 0.6 }]], ['night', 'digital']],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  BD.useTheme = function (key, palette) {
    const bd = BD.ensure(), [, kinds, pals] = BD.THEMES[key] || BD.THEMES.countryside;
    bd.on = true; bd.theme = key; bd.palette = palette || pick(pals);
    bd.layers = kinds.map((k) => (Array.isArray(k) ? BD.newLayer(k[0], k[1]) : BD.newLayer(k)));
    BD.landForTheme(key);
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
  // Detail level (doc.backdrop.detail): 0 simple, 1 normal, 2 high, 3 extra
  let DET = 1;
  function skyline(l, P, d) {
    const r = rng(l.seed), H = l.height ?? 1, pts = [], N = 3 * (DET >= 2 ? 360 : 180);
    const at = (fn) => { for (let i = 0; i <= N; i++) { const x = -1.5 * P + (3 * P * i) / N; pts.push([x, fn(x)]); } return pts; };
    if (l.kind === 'hills') { const ws = waves(r, P, [[1, 2, 1], [2, 4, 0.5], [5, 8, 0.15]]); return at((x) => d * H * (0.05 + 0.025 * sumWaves(ws, P, x))); }
    if (l.kind === 'mountains') { const ws = waves(r, P, [[2, 4, 1], [5, 9, 0.45], [11, 19, 0.18], [23, 37, 0.07], ...(DET >= 2 ? [[41, 67, 0.035]] : []), ...(DET >= 3 ? [[71, 113, 0.018]] : [])].slice(0, DET === 0 ? 2 : 99)); return at((x) => d * H * (0.03 + 0.09 * ridge(ws, P, x))); }
    if (l.kind === 'sea') { const ws = waves(r, P, [[18, 26, 1], [31, 45, 0.5]]); return at((x) => d * H * (0.012 + 0.0025 * sumWaves(ws, P, x))); }
    if (l.kind === 'trees') {
      const ws = waves(r, P, [[1, 3, 1], [4, 7, 0.4]]), trees = [], n = Math.round((P / (d * 0.022)) * [0.6, 1, 1.4, 1.8][DET]);
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
    const r = rng(l.seed), H = l.height ?? 1, n = 4 + Math.floor(r() * 4), clouds = [], extra = DET * 2;
    for (let i = 0; i < n; i++) {
      const cx = (i + r() * 0.7) * (P / n) - P / 2, cy = d * (0.2 + 0.16 * r()) * H, size = d * (0.035 + 0.035 * r()), m = 3 + extra + Math.floor(r() * 4), puffs = [];
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
    const base = new T.Color(P[l.kind === 'forest' ? 'trees' : l.kind] || '#888888'), f = (0.04 + 0.46 * Math.max(0, Math.min(1, (d - BD.NEAR) / (BD.FAR - BD.NEAR)))) * (l.haze ?? 1);
    return base.lerp(new T.Color(P.haze), l.kind === 'sun' || l.kind === 'stars' ? 0 : f);
  }
  function buildLayer(l, bd, d) {
    DET = bd.detail ?? 1;
    const g = new T.Group(), P = (BD.PALETTES[bd.palette] || BD.PALETTES.day)[1], per = periodOf(d), style = l.style || bd.style || 'classic';
    const col = colourOf(l, P, d), hex = '#' + col.getHexString(), light = '#' + col.clone().lerp(new T.Color('#ffffff'), 0.35).getHexString(), dark = '#' + col.clone().lerp(new T.Color('#000000'), 0.55).getHexString();
    // everything stands on the ground: nothing hangs below the horizon
    const bottom = 0;
    g.userData = { layer: l.id, period: per, dist: d };
    if (['hills', 'mountains', 'sea', 'trees', 'city'].includes(l.kind)) {
      const pts = skyline(l, per, d), sh = groundShape(pts, bottom);
      if (style === 'cardboard') { cardboard(g, [sh], col, d, per, pts, null, bd.stands !== false); }
      else if (style === 'modern') {
        const depth = d * 0.03, bev = Math.min(d * 0.02, 1.2);
        const geo = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: l.kind === 'city' ? bev * 0.25 : bev, bevelSegments: l.kind === 'city' ? 2 : 5, curveSegments: 4, steps: 1 });
        const m3 = mesh(geo, new T.MeshStandardMaterial({ color: col, roughness: l.kind === 'sea' ? 0.25 : 0.9, metalness: 0 }), -depth / 2); m3.position.y = bev; g.add(m3);
      } else {
        g.add(mesh(new T.ShapeGeometry(sh), mat(hex)));
        if (l.kind !== 'city') g.add(mesh(new T.ShapeGeometry(edgeBand(pts, d * (l.kind === 'sea' ? 0.004 : 0.008))), mat(light), 0.02));
        const shadow = mesh(new T.ShapeGeometry(sh), mat(dark, { opacity: 0.35 }), -0.15); shadow.position.x = d * 0.006; shadow.position.y = -d * 0.008; g.add(shadow);
      }
      // detail laid over the front of the layer
      const zf = style === 'modern' ? d * 0.015 + Math.min(d * 0.02, 1.2) + 0.03 : style === 'cardboard' ? Math.max(0.08, d * 0.004) / 2 + 0.03 : 0.035, lift = style === 'modern' ? Math.min(d * 0.02, 1.2) : 0;
      const over = (geo, color, z = 0, glow) => { const m2 = mesh(geo, glow ? new T.MeshBasicMaterial({ color }) : mat(color)); m2.position.set(0, lift, zf + z); g.add(m2); };
      const triGeo = (tris) => { const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(tris, 3)); gg.computeVertexNormals(); return gg; };
      if (l.kind === 'mountains' && DET >= 1) {
        // shaded slopes (the sides facing away from the light, which comes from the left) and snow on the peaks
        const top = Math.max(...pts.map((q) => q[1])), snowLine = top * (DET >= 3 ? 0.62 : 0.7), shade = [], snow = [], sd = d * 0.035;
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
          if (DET >= 2 && y1 < y0) shade.push(x0, y0, 0, x0, Math.max(0, y0 - sd), 0, x1, y1, 0, x1, y1, 0, x0, Math.max(0, y0 - sd), 0, x1, Math.max(0, y1 - sd), 0);
          if (y0 > snowLine && y1 > snowLine) { const b0 = Math.max(snowLine, y0 - (y0 - snowLine) * 0.75 - d * 0.004 * Math.sin(x0 * 3)), b1 = Math.max(snowLine, y1 - (y1 - snowLine) * 0.75 - d * 0.004 * Math.sin(x1 * 3)); snow.push(x0, y0, 0, x0, b0, 0, x1, y1, 0, x1, y1, 0, x0, b0, 0, x1, b1, 0); }
        }
        if (shade.length) over(triGeo(shade), '#' + col.clone().lerp(new T.Color('#1b2333'), 0.28).getHexString(), -0.01);
        if (snow.length) over(triGeo(snow), '#' + new T.Color('#ffffff').lerp(new T.Color(P.haze), 0.15).getHexString(), 0.005);
      }
      if (l.kind === 'hills' && DET >= 2) {
        // bushes and rocks along the hills
        const r = rng(l.seed + 3), bush = [], rocks = [], n = Math.round((per / (d * 0.05)) * (DET - 1));
        for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) {
          const x = k * per + (i + r()) * (per / n) - per / 2, near = pts.reduce((a, q) => (Math.abs(q[0] - x) < Math.abs(a[0] - x) ? q : a), pts[0]), y = near[1] * (0.35 + 0.6 * r());
          if (r() < 0.75) bush.push(new T.CircleGeometry(d * (0.006 + 0.006 * r()), 12).translate(x, y, 0)); else rocks.push(new T.CircleGeometry(d * (0.004 + 0.004 * r()), 6).translate(x, y, 0));
        }
        if (bush.length) over(merge(bush), '#' + col.clone().lerp(new T.Color('#1d4d22'), 0.35).getHexString());
        if (rocks.length) over(merge(rocks), '#' + col.clone().lerp(new T.Color('#8f8f8f'), 0.6).getHexString(), 0.002);
      }
      if (l.kind === 'city' && pts.blds && DET >= 1) {
        // rooftops: water towers, boxes, stepped tops and spires; at high detail, the shaded side of each building
        const r = rng(l.seed + 11), roof = [], side = [], sh2 = (pts2) => { const S = new T.Shape(); S.moveTo(pts2[0][0], pts2[0][1]); pts2.slice(1).forEach(([x, y]) => S.lineTo(x, y)); S.closePath(); return new T.ShapeGeometry(S); };
        [-per, 0, per].forEach((k) => pts.blds.forEach((b, bi) => {
          const x0 = b.x + k, w = b.w, h = b.h, u = rng(l.seed + bi * 31)();
          if (u < 0.18) roof.push(sh2([[x0 + w * 0.2, h], [x0 + w * 0.8, h], [x0 + w * 0.8, h + d * 0.012], [x0 + w * 0.2, h + d * 0.012]]), sh2([[x0 + w * 0.35, h + d * 0.012], [x0 + w * 0.65, h + d * 0.012], [x0 + w * 0.65, h + d * 0.022], [x0 + w * 0.35, h + d * 0.022]]));
          else if (u < 0.3) roof.push(sh2([[x0 + w * 0.3, h], [x0 + w * 0.7, h], [x0 + w * 0.5, h + d * 0.04]]));
          else if (u < 0.45) { const tx = x0 + w * (0.25 + 0.4 * r()), tw = d * 0.012; roof.push(sh2([[tx, h], [tx + d * 0.002, h], [tx + d * 0.002, h + d * 0.008], [tx, h + d * 0.008]]), sh2([[tx + tw - d * 0.002, h], [tx + tw, h], [tx + tw, h + d * 0.008], [tx + tw - d * 0.002, h + d * 0.008]]), sh2([[tx - d * 0.001, h + d * 0.008], [tx + tw + d * 0.001, h + d * 0.008], [tx + tw + d * 0.001, h + d * 0.02], [tx - d * 0.001, h + d * 0.02]]), sh2([[tx - d * 0.002, h + d * 0.02], [tx + tw + d * 0.002, h + d * 0.02], [tx + tw / 2, h + d * 0.026]])); }
          else if (u < 0.7 && DET >= 2) for (let q = 0; q < 2; q++) { const bx = x0 + w * (0.15 + 0.5 * r()), bw = d * 0.006; roof.push(sh2([[bx, h], [bx + bw, h], [bx + bw, h + bw * 0.7], [bx, h + bw * 0.7]])); }
          if (DET >= 2) side.push(sh2([[x0 + w * 0.82, 0], [x0 + w, 0], [x0 + w, h], [x0 + w * 0.82, h]]));
        }));
        if (roof.length) { const rg = merge(roof); const m2 = mesh(rg, style === 'modern' ? new T.MeshStandardMaterial({ color: col, roughness: 0.8 }) : mat(hex)); m2.position.set(0, lift, style === 'modern' ? 0 : 0); g.add(m2); }
        if (side.length) over(merge(side), '#' + col.clone().lerp(new T.Color('#000000'), 0.22).getHexString(), -0.01);
      }
      if (l.kind === 'city' && pts.blds) {
        // windows: lit at sunset and at night
        const r = rng(l.seed + 7), quads = [], ws = d * 0.006, zf = style === 'modern' ? d * 0.015 + Math.min(d * 0.02, 1.2) + 0.02 : 0.03;
        [-per, 0, per].forEach((k) => pts.blds.forEach((b) => {
          for (let y = d * 0.012; y < b.h - d * 0.01; y += ws * 2.4) for (let x = b.x + ws * 1.2; x < b.x + b.w - ws * 1.2; x += ws * 2.2) if (r() < (P.lit ? 0.45 : 0.7) * [0.5, 1, 1, 1.15][DET]) { const q = new T.PlaneGeometry(ws, ws * 1.3); q.translate(x + k + ws / 2, y, zf); quads.push(q); }
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
    } else if (l.kind === 'planets') {
      buildPlanets(g, l, d, per, style, bd);
    } else if (['forest', 'islands', 'playground', 'circuit', 'pixels', 'birds', 'balloons', 'rainbow'].includes(l.kind)) {
      buildItems(g, makeItems(l, per, d, P, col), style, d, per, col, l, bd);
    } else if (l.kind === 'picture') {
      buildPicture(g, l, d, per, style, bd);
    } else if (l.kind === 'stars') {
      const r = rng(l.seed), list = [], n = Math.round(per * 1.4);
      for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) { const rr = d * (0.0015 + 0.003 * r() ** 3); list.push(new T.CircleGeometry(rr, 6).translate((r() - 0.5) * per + k * per, d * (0.06 + 0.55 * r()) * (l.height ?? 1), 0)); }
      g.add(mesh(merge(list), new T.MeshBasicMaterial({ color: col })));
    } else if (l.kind === 'sun') {
      const r = rng(l.seed), x = (r() - 0.5) * per * 0.5, y = d * (0.16 + 0.14 * r()) * (l.height ?? 1), rad = d * 0.045;
      const moon = bd.palette === 'night', digital = bd.palette === 'digital';
      if (moon) {
        // the moon: a cratered grey world, lit from one side; a real sphere in Modern and Cardboard
        const map = planetMap('moon', l.seed + 101);
        if (style === 'classic') g.add(mesh(new T.CircleGeometry(rad, 64).translate(x, y, 0), new T.MeshBasicMaterial({ map: planetDisc(map, rad, 1.45), transparent: true, alphaTest: 0.02 })));
        else { const ms = new T.Mesh(new T.SphereGeometry(rad, 64, 40), new T.MeshStandardMaterial({ map, roughness: 1, emissive: new T.Color('#ffffff'), emissiveMap: map, emissiveIntensity: 0.6 })); ms.position.set(x, y, 0); ms.rotation.y = 0.6; g.add(ms); }
        g.add(mesh(new T.CircleGeometry(rad * 1.6, 64).translate(x, y, 0), new T.MeshBasicMaterial({ map: glowMap('#dfe7ff'), transparent: true, depthWrite: false }), -0.05));
      } else {
        // the sun: a glowing disc with a mottled surface, brighter in the middle, and a soft corona with rays
        g.add(mesh(new T.CircleGeometry(rad, 64).translate(x, y, 0), new T.MeshBasicMaterial({ map: sunMap(col, digital, l.seed), transparent: true, alphaTest: 0.02, toneMapped: false })));
        g.add(mesh(new T.CircleGeometry(rad * 3.2, 64).translate(x, y, 0), new T.MeshBasicMaterial({ map: coronaMap(col, digital), transparent: true, depthWrite: false, toneMapped: false }), -0.05));
        if (digital) { const bars = []; for (let i = 0; i < 5; i++) { const h = rad * (0.06 + i * 0.035), yy = y - rad * (0.15 + i * 0.18); bars.push(new T.PlaneGeometry(rad * 2.2, h).translate(x, yy, 0)); } g.add(mesh(merge(bars), new T.MeshBasicMaterial({ color: new T.Color(P.sky[1]) }), 0.02)); }
      }
    } else if (l.kind === 'traffic') {
      buildTraffic(g, l, d, per, P);
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
      const xs = c.map((p) => p[0]), low = Math.min(...c.map((p) => p[1])), x = (Math.min(...xs) + Math.max(...xs)) / 2, stick = new T.BoxGeometry(t * 1.5, low, t * 1.5);
      stick.translate(x, low / 2, -t * 1.5); stands.push(stick);
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
    if (l.kind === 'forest') {
      const type = l.type || 'oak', dens = l.density ?? 1, trunk = '#5b3a22';
      const hex = (c) => '#' + c.getHexString(), vary = (k) => { const c = new T.Color(col), hsl = {}; c.getHSL(hsl); return hex(c.setHSL(hsl.h + (r() - 0.5) * 0.04, hsl.s, Math.max(0.12, Math.min(0.85, hsl.l * (0.85 + 0.3 * r()) + (k || 0))))); };
      const pine = (x, h) => { add(bar(x, 0, x, h * 0.3, h * 0.07), trunk); const tiers = []; for (let k = 0; k < 4; k++) { const y0 = h * (0.14 + 0.2 * k), hw = h * 0.27 * (1 - 0.19 * k), t = new T.Shape(); t.moveTo(x - hw, y0); t.lineTo(x + hw, y0); t.lineTo(x, y0 + h * 0.36); t.closePath(); tiers.push(t); } add(tiers, vary(), { z: 0.01 }); };
      const oak = (x, h, big) => {
        const tw = h * (big ? 0.09 : 0.07); add([bar(x, 0, x, h * 0.55, tw), bar(x, h * 0.4, x - h * 0.16, h * 0.62, tw * 0.5), bar(x, h * 0.45, x + h * 0.18, h * 0.66, tw * 0.5)], trunk);
        const cy = h * 0.68, R = h * (big ? 0.36 : 0.28), c = new T.Color(vary()), blobs = [disc(x, cy, R * 0.75)], dark = [], light = [];
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(); blobs.push(disc(x + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.35, R * (0.5 + 0.25 * r()))); }
        for (let k = 0; k < 3; k++) dark.push(disc(x + (r() - 0.3) * R * 0.8, cy - R * 0.35, R * 0.4));
        for (let k = 0; k < 3; k++) light.push(disc(x + (r() - 0.7) * R * 0.6, cy + R * 0.4, R * 0.28));
        add(blobs, hex(c), { z: 0.01 }); add(dark, hex(c.clone().multiplyScalar(0.72)), { z: 0.015 }); add(light, hex(c.clone().lerp(new T.Color('#fff7c2'), 0.25)), { z: 0.02 });
      };
      if (type === 'pine') { const n = Math.round((P / (d * 0.06)) * dens); for (let i = 0; i < n; i++) pine((i + r()) * (P / n) - P / 2, d * (0.11 + 0.07 * r()) * H); }
      else if (type === 'oak') { const n = Math.round((P / (d * 0.11)) * dens); for (let i = 0; i < n; i++) oak((i + r()) * (P / n) - P / 2, d * (0.11 + 0.06 * r()) * H); }
      else if (type === 'open') {
        // a meadow with a few big trees standing well apart
        add(rect(-P / 2, 0, P, d * 0.006), hex(new T.Color(col).lerp(new T.Color('#9be38a'), 0.35)));
        const n = Math.max(2, Math.round((P / (d * 0.4)) * dens)); for (let i = 0; i < n; i++) { const x = (i + 0.2 + r() * 0.6) * (P / n) - P / 2; if (r() < 0.3) pine(x, d * 0.2 * H); else oak(x, d * (0.17 + 0.07 * r()) * H, true); }
      } else if (type === 'jungle') {
        // a thick canopy wall, tall trees with flat umbrella crowns above it, palms, and vines hanging down
        const band = d * 0.11 * H, wall = [rect(-P / 2, 0, P, band * 0.7)], n = Math.round((P / (d * 0.035)) * dens);
        for (let i = 0; i < n; i++) wall.push(disc((i + r()) * (P / n) - P / 2, band * (0.55 + 0.35 * r()), d * (0.032 + 0.025 * r()) * H));
        add(wall, vary(-0.03));
        const hi = []; for (let i = 0; i < n * 0.6; i++) hi.push(disc((r() - 0.5) * P, band * (0.75 + 0.3 * r()), d * (0.018 + 0.014 * r()) * H)); add(hi, vary(0.06), { z: 0.01 });
        const m = Math.round((P / (d * 0.18)) * dens);
        for (let i = 0; i < m; i++) {
          const x = (i + r()) * (P / m) - P / 2, h = d * (0.2 + 0.08 * r()) * H, c = vary(0.02);
          if (r() < 0.35) {
            const tx = x + (r() - 0.5) * h * 0.25, ty = h * 0.85, fr = [];
            add(bar(x, band * 0.5, tx, ty, d * 0.005), '#7a5a3a', { z: 0.02 });
            for (let a = 0; a < 7; a++) { const ang = Math.PI * (0.02 + a * 0.16), L2 = h * 0.22; fr.push(bar(tx, ty, tx + Math.cos(ang) * L2, ty + Math.sin(ang) * L2 * 0.35 - L2 * 0.12, d * 0.008)); }
            add(fr, c, { z: 0.03 });
          } else {
            add([bar(x, band * 0.4, x, h, d * 0.006), bar(x, h * 0.85, x - h * 0.12, h * 0.98, d * 0.003), bar(x, h * 0.85, x + h * 0.12, h * 0.98, d * 0.003)], '#6b4a30', { z: 0.02 });
            const crown = []; for (let k = 0; k < 5; k++) { const sh = new T.Shape(); sh.absellipse(x + (k - 2) * h * 0.09, h + h * 0.02 * Math.sin(k), h * 0.1, h * 0.045, 0, Math.PI * 2, false, 0); crown.push(sh); }
            add(crown, c, { z: 0.03 });
            const vines = []; for (let k = 0; k < 3; k++) { const vx = x + (r() - 0.5) * h * 0.4; vines.push(bar(vx, h * 0.97, vx + (r() - 0.5) * h * 0.05, h * (0.45 + 0.3 * r()), d * 0.0018)); }
            add(vines, '#2f5d32', { z: 0.035 });
          }
        }
      } else if (type === 'ferns') {
        // undergrowth along the front: fans of fronds
        add(rect(-P / 2, 0, P, d * 0.008), vary(-0.08));
        const n = Math.round((P / (d * 0.03)) * dens);
        for (let i = 0; i < n; i++) { const x = (i + r()) * (P / n) - P / 2, h = d * (0.04 + 0.04 * r()) * H, fr = []; for (let a = 0; a < 9; a++) { const ang = Math.PI * (0.12 + a * 0.095), L2 = h * (0.7 + 0.3 * Math.sin((a / 8) * Math.PI)); fr.push(bar(x, 0, x + Math.cos(ang) * L2, Math.sin(ang) * L2, d * 0.005)); } add(fr, vary((r() - 0.5) * 0.1)); }
      }
    } else if (l.kind === 'islands') {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.2 + r() * 0.6) * (P / n) - P / 2, w = d * (0.14 + 0.16 * r()), h = d * H * (0.035 + 0.04 * r());
        const hump = (k) => { const sh = new T.Shape(); sh.moveTo(cx - w * k, 0); for (let j = 0; j <= 24; j++) { const u = j / 24, x = cx - w * k + 2 * w * k * u; sh.lineTo(x, h * k * Math.sin(u * Math.PI) ** 0.7); } sh.lineTo(cx + w * k, 0); sh.closePath(); return sh; };
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
      const base = d * 0.012; add(rect(-P / 2, 0, P, base), col);
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
        if (it.sky) { if (it.z) return; const st = new T.BoxGeometry(t * 1.5, minY, t * 1.5); st.translate(x, minY / 2, -t * 1.5); stands.push(st); }
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

  // ---------------------------------------------------------------- a ground that matches the backdrop
  // A big disc of landscape round the scene (grass, sand, paving, forest floor, rock, a neon grid, or a beach with water
  // beyond), whose colour fades into the front layer's colour where the scenery stands, so the two meet without a line.
  BD.GROUNDS = { auto: 'Automatic (from the backdrop)', grass: 'Grass', flowers: 'Grass with flowers', forest: 'Forest floor', sand: 'Sand', beach: 'Beach and water', paving: 'Paving', playground: 'Grass and a play surface', grid: 'Neon grid', rock: 'Rocky ground' };
  const THEME_GROUND = { countryside: 'grass', city: 'paving', seaside: 'beach', islands: 'beach', desert: 'sand', nightcity: 'paving', playground: 'playground', computer: 'grid', rainbow: 'flowers', balloons: 'grass', meadow: 'flowers', pineforest: 'forest', woodland: 'forest', rainforest: 'forest', space: 'rock' };
  // doc.land = { on, kind, blend, beach, terrain: flat | rolling | hills | dunes, relief, flat (radius kept flat round the
  // scene), grass, flowers, rocks, pebbles, shrubs (how much of each, 0 to 3), haze (0 to 1), seed }
  BD.TERRAINS = { flat: 'Flat', rolling: 'Gentle rolling', hills: 'Hills', dunes: 'Dunes' };
  BD.FILLERS = { grass: 'Grass (fuzz)', flowers: 'Flowers', rocks: 'Rocks (rockscape)', pebbles: 'Pebbles', shrubs: 'Shrubs' };
  BD.land = function () {
    if (!E.doc) return null;
    if (!E.doc.land) { const bd = E.doc.backdrop; E.doc.land = { on: !!(bd && bd.on && bd.groundOn !== false), kind: (bd && bd.groundKind) || 'auto', blend: !(bd && bd.blend === false), beach: (bd && bd.beach) ?? 14, terrain: 'flat', relief: 1, flat: 14, grass: 0, flowers: 0, rocks: 0, pebbles: 0, shrubs: 0, haze: 0, seed: 7 }; }
    return E.doc.land;
  };
  // a sensible start for the land that suits a backdrop theme
  const THEME_LAND = { countryside: { terrain: 'rolling', grass: 1.5, flowers: 0.5, rocks: 0.4, shrubs: 0.6 }, meadow: { terrain: 'rolling', grass: 2, flowers: 1.5, shrubs: 0.4 }, rainbow: { terrain: 'rolling', grass: 1.5, flowers: 2 }, balloons: { terrain: 'rolling', grass: 1.2, flowers: 0.6 },
    pineforest: { terrain: 'hills', grass: 1, rocks: 0.8, shrubs: 1, pebbles: 0.5 }, woodland: { terrain: 'rolling', grass: 1.2, rocks: 0.4, shrubs: 1.2 }, rainforest: { terrain: 'rolling', grass: 2.5, shrubs: 2 },
    desert: { terrain: 'dunes', rocks: 0.8, pebbles: 1 }, space: { terrain: 'hills', rocks: 1.5, pebbles: 1.5 }, seaside: { rocks: 0.5, pebbles: 1 }, islands: { pebbles: 0.8 }, playground: { terrain: 'flat', grass: 1.2, flowers: 0.4 }, city: {}, nightcity: {}, computer: {} };
  BD.landForTheme = (theme) => { const L = BD.land(); Object.assign(L, { on: true, terrain: 'flat', grass: 0, flowers: 0, rocks: 0, pebbles: 0, shrubs: 0 }, THEME_LAND[theme] || {}); };
  function groundKind(bd) {
    const land = BD.land(); if (land && land.kind && land.kind !== 'auto') return land.kind;
    if (bd.theme && THEME_GROUND[bd.theme]) return THEME_GROUND[bd.theme];
    const front = [...bd.layers].reverse().find((l) => l.visible !== false && !BD.SKY.includes(l.kind) && !['sun', 'stars', 'planets'].includes(l.kind));
    const k = front && front.kind;
    return k === 'sea' || k === 'islands' ? 'beach' : k === 'city' ? 'paving' : k === 'forest' ? 'forest' : k === 'circuit' ? 'grid' : k === 'playground' ? 'playground' : bd.palette === 'desert' ? 'sand' : 'grass';
  }
  // a tiling picture for the ground, drawn with wrap-round so its edges join
  const groundTexCache = new Map();
  function groundTexture(kind, P) {
    const key = kind + JSON.stringify(P); if (groundTexCache.has(key)) return groundTexCache.get(key);
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), r = rng(kind.length * 977 + 13);
    const col = (h, k) => '#' + new T.Color(h).offsetHSL(0, 0, k).getHexString();
    const wrap = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) fn(dx, dy); };
    const speck = (n, colours, size) => { for (let i = 0; i < n; i++) { const px = r() * N, py = r() * N, s2 = size * (0.5 + r()), cc = colours[Math.floor(r() * colours.length)]; x.fillStyle = cc; wrap((dx, dy) => x.fillRect(px + dx, py + dy, s2, s2)); } };
    let base = '#808080';
    if (kind === 'grass' || kind === 'flowers' || kind === 'playground') {
      // grass stays green, just tinted by the palette's light
      base = '#' + new T.Color('#5fa84e').lerp(new T.Color(P.hills), 0.3).lerp(new T.Color(P.haze), 0.1).getHexString(); x.fillStyle = base; x.fillRect(0, 0, N, N);
      for (let i = 0; i < 9000; i++) { const px = r() * N, py = r() * N, a = r() * Math.PI, l2 = 3 + r() * 6; x.strokeStyle = col(base, (r() - 0.5) * 0.16); x.lineWidth = 1 + r(); wrap((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * l2, py + dy + Math.sin(a) * l2); x.stroke(); }); }
      if (kind === 'flowers') speck(500, ['#ffffff', '#ffe066', '#ff8787', '#da77f2', '#ffd8a8'], 3);
    } else if (kind === 'forest') {
      base = '#' + new T.Color('#55633a').lerp(new T.Color(P.trees), 0.25).lerp(new T.Color('#6b4a2e'), 0.3).offsetHSL(0, 0, 0.04).getHexString(); x.fillStyle = base; x.fillRect(0, 0, N, N);
      for (let i = 0; i < 2600; i++) { const px = r() * N, py = r() * N, a = r() * Math.PI, w = 3 + r() * 5; x.fillStyle = [col(base, 0.05), col(base, -0.05), '#' + new T.Color(base).lerp(new T.Color('#8a5a2b'), 0.4).getHexString(), '#' + new T.Color(base).lerp(new T.Color('#a8742f'), 0.35).getHexString(), '#' + new T.Color(base).lerp(new T.Color(P.trees), 0.4).getHexString()][Math.floor(r() * 5)]; wrap((dx, dy) => { x.save(); x.translate(px + dx, py + dy); x.rotate(a); x.beginPath(); x.ellipse(0, 0, w, w * 0.45, 0, 0, Math.PI * 2); x.fill(); x.restore(); }); }
    } else if (kind === 'sand' || kind === 'beach') {
      base = P.sand || '#e9d29a'; x.fillStyle = base; x.fillRect(0, 0, N, N); speck(14000, [col(base, 0.06), col(base, -0.06), col(base, -0.12)], 1.4);
      x.strokeStyle = col(base, 0.08); x.lineWidth = 3; for (let k = 0; k < 9; k++) { x.beginPath(); for (let i = 0; i <= N; i += 4) { const yy = (k / 9) * N + 10 * Math.sin((i / N) * Math.PI * 2 * 3 + k); i ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke(); }
    } else if (kind === 'paving') {
      base = '#' + new T.Color(P.city).lerp(new T.Color('#c9ccd1'), 0.55).getHexString(); x.fillStyle = base; x.fillRect(0, 0, N, N); speck(9000, [col(base, 0.05), col(base, -0.05)], 1.5);
      x.strokeStyle = col(base, -0.18); x.lineWidth = 3; for (let i = 0; i <= N; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(N, i); x.stroke(); }
    } else if (kind === 'grid') {
      base = P.sky[0]; x.fillStyle = base; x.fillRect(0, 0, N, N);
      x.strokeStyle = P.traces || '#39ff88'; x.shadowColor = x.strokeStyle; x.shadowBlur = 10; x.lineWidth = 3;
      for (let i = 0; i <= N; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(N, i); x.stroke(); }
    } else if (kind === 'rock') {
      base = P.mountains; x.fillStyle = base; x.fillRect(0, 0, N, N); speck(12000, [col(base, 0.07), col(base, -0.07), col(base, -0.14)], 2);
      for (let i = 0; i < 26; i++) { const px = r() * N, py = r() * N, rr = 6 + r() * 26; wrap((dx, dy) => { x.fillStyle = col(base, -0.1); x.beginPath(); x.arc(px + dx, py + dy, rr, 0, Math.PI * 2); x.fill(); x.strokeStyle = col(base, 0.1); x.lineWidth = 2 + rr * 0.1; x.beginPath(); x.arc(px + dx - 1, py + dy - 1, rr, Math.PI * 0.9, Math.PI * 1.9); x.stroke(); }); }
    }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 8;
    const res = { tex, base }; groundTexCache.set(key, res); return res;
  }
  // the height of the land at (x, z), for the chosen terrain (flat close to the scene, lower again near the backdrop)
  function landHeight(land) {
    const r = rng(land.seed || 7), relief = land.relief ?? 1, flatR = land.flat ?? 14, t = land.terrain || 'flat';
    if (t === 'flat') return () => 0;
    const waves2 = Array.from({ length: 6 }, (_, i) => ({ kx: (r() - 0.5) * (0.05 + i * 0.05), kz: (r() - 0.5) * (0.05 + i * 0.05), ph: r() * 6.28, a: 1 / (1 + i * 1.2) }));
    const amp = { rolling: 1.6, hills: 5, dunes: 2.4 }[t] * relief, dir = r() * Math.PI;
    return (x, z) => {
      const rr = Math.hypot(x, z), sm = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
      const fade = sm(flatR, flatR + 16, rr) * (1 - 0.65 * sm(58, 80, rr));
      if (fade <= 0) return 0;
      let h;
      if (t === 'dunes') { const u = x * Math.cos(dir) + z * Math.sin(dir); h = 0; for (let i = 0; i < 3; i++) { const w = waves2[i]; h += w.a * (1 - Math.abs(Math.sin(u * (0.07 + i * 0.05) + w.ph + Math.sin((x + z) * 0.03 + i))) ** 1.5); } h *= 0.7; }
      else { h = 0; waves2.forEach((w) => { h += w.a * Math.sin(x * w.kx + z * w.kz + w.ph); }); h = (h + 1.6) * 0.5; }
      return Math.max(0, h) * amp * fade;
    };
  }
  // lift a flat (already turned) ring to follow the land
  function follow(geo, H, lift = 0) { const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, H(pos.getX(i), pos.getZ(i)) + lift); geo.computeVertexNormals(); return geo; }
  // filler scattered over the land: grass fuzz, flowers, rocks, pebbles, shrubs (built as one piece each, so they ray-trace)
  function buildFiller(g, land, kind, P, H) {
    const r = rng((land.seed || 7) * 31 + 5), flatR = land.flat ?? 14, beachR = land.beach ?? 14, outer = 70;
    // filler keeps out of the flat area round the scene (grass may creep in a little)
    let inner = flatR;
    // places thin out gradually towards the scene (no hard edge), from inner*0.5 to inner*1.3
    const where = () => { for (let k = 0; k < 30; k++) { const lo = inner * 0.5, rr = lo + (outer - lo) * r() ** 1.6, a = r() * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (kind === 'beach' && rr > beachR - 0.5) continue; const u = Math.max(0, Math.min(1, (rr - lo) / (inner * 0.8))); if (r() > u * u * (3 - 2 * u)) continue; return [x, z, rr]; } return null; };
    const grassCol = new T.Color('#5fa84e').lerp(new T.Color(P.hills), 0.3), rockCol = new T.Color(kind === 'rock' ? P.mountains : kind === 'sand' || kind === 'beach' ? '#b9a27c' : '#8c8f94');
    const colourMesh = (positions, colours, matOpts = {}) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(colours, 3)); geo.computeVertexNormals(); const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide, ...matOpts })); m.receiveShadow = true; g.add(m); return m; };
    const pushGeo = (list, geo, c, out, cols) => { const n = geo.index ? geo.toNonIndexed() : geo, pa = n.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { out.push(pa[i], pa[i + 1], pa[i + 2]); cols.push(c.r, c.g, c.b); } };
    // grass: tufts of three thin blades leaning a little
    if (land.grass > 0 && kind !== 'grid' && kind !== 'paving') {
      inner = Math.max(2, flatR * 0.75);
      const pos = [], col = [], n = Math.round(land.grass * 5000);
      for (let i = 0; i < n; i++) { const w = where(); if (!w) continue; const [x, z, rr] = w, y = H(x, z), s2 = (0.35 + 0.5 * r()) * (1 + rr / 60);
        for (let b = 0; b < 3; b++) { const a = r() * Math.PI, lx = Math.cos(a) * 0.05 * s2, lz = Math.sin(a) * 0.05 * s2, tx = (r() - 0.5) * 0.25 * s2, tz = (r() - 0.5) * 0.25 * s2, c = grassCol.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.12);
          pos.push(x - lx, y, z - lz, x + lx, y, z + lz, x + tx, y + s2, z + tz); const dk = c.clone().multiplyScalar(0.6); col.push(dk.r, dk.g, dk.b, dk.r, dk.g, dk.b, c.r, c.g, c.b); } }
      if (pos.length) colourMesh(pos, col);
      inner = flatR;
    }
    // flowers: little coloured heads on short stalks
    if (land.flowers > 0 && kind !== 'grid' && kind !== 'paving') {
      const pos = [], col = [], n = Math.round(land.flowers * 900), hues = ['#ffffff', '#ffe066', '#ff8787', '#da77f2', '#ffa94d', '#74c0fc'];
      for (let i = 0; i < n; i++) { const w = where(); if (!w) continue; const [x, z, rr] = w, y = H(x, z), s2 = 0.35 * (1 + rr / 60), c = new T.Color(hues[Math.floor(r() * hues.length)]), head = new T.IcosahedronGeometry(0.09 * s2 * 1.6, 0); head.translate(x, y + s2, z); pushGeo(null, head, c, pos, col); pos.push(x, y, z, x + 0.02, y, z, x, y + s2, z); col.push(0.2, 0.5, 0.2, 0.2, 0.5, 0.2, 0.25, 0.55, 0.25); }
      if (pos.length) colourMesh(pos, col);
    }
    // rocks: lumpy, half sunk, faceted; pebbles: small and many; shrubs: rounded clumps
    const lumps = (count, sizeA, sizeB, detail, baseCol, flat, sink) => {
      const pos = [], col = [];
      for (let i = 0; i < count; i++) {
        const w = where(); if (!w) continue; const [x, z, rr] = w, y = H(x, z), sz = (sizeA + (sizeB - sizeA) * r() ** 2) * (1 + rr / 80), geo = new T.IcosahedronGeometry(sz, detail), pa = geo.attributes.position, k = [r() * 6, r() * 6, r() * 6];
        for (let q = 0; q < pa.count; q++) { const v = new T.Vector3().fromBufferAttribute(pa, q), dv = v.clone().normalize(), m2 = 1 + 0.25 * Math.sin(dv.x * 3 + k[0]) * Math.cos(dv.y * 2.5 + k[1]) + 0.12 * Math.sin(dv.z * 5 + k[2]); v.multiplyScalar(m2); pa.setXYZ(q, v.x, v.y * flat, v.z); }
        geo.rotateY(r() * 6.28); geo.translate(x, y + sz * flat * sink, z);
        pushGeo(null, geo, baseCol.clone().offsetHSL(0, 0, (r() - 0.5) * 0.12), pos, col);
      }
      if (pos.length) { const m = colourMesh(pos, col, { flatShading: true, side: T.FrontSide }); m.castShadow = true; }
    };
    if (land.rocks > 0) lumps(Math.round(land.rocks * 140), 0.25, 1.7, 1, rockCol, 0.7, 0.25);
    if (land.pebbles > 0) lumps(Math.round(land.pebbles * 700), 0.06, 0.22, 0, rockCol.clone().lerp(new T.Color('#ffffff'), 0.15), 0.6, 0.2);
    if (land.shrubs > 0 && kind !== 'grid') lumps(Math.round(land.shrubs * 120), 0.35, 1, 1, grassCol.clone().multiplyScalar(0.7), 0.8, 0.5);
  }
  const waveTex = () => E.waveTexture();
  const GROUND_R = 140;
  function buildGround(bd) {
    const land = BD.land(), H = landHeight(land);
    const P = (BD.PALETTES[bd.palette] || BD.PALETTES.day)[1], kind = groundKind(bd), g = new T.Group(); g.name = 'backdrop-ground';
    const disc2 = (r0, r1, mat2, y, flat) => { const geo = new T.RingGeometry(r0, r1, 160, flat ? 1 : 70); geo.rotateX(-Math.PI / 2); if (!flat) follow(geo, H); const m = new T.Mesh(geo, mat2); m.position.y = y; m.receiveShadow = true; return m; };
    const tile = (kind2, rep) => { const { tex } = groundTexture(kind2, P), t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(rep, rep); return t2; };
    // the main ground: a tiled texture over the whole disc (UVs run 0 to 1 across it: about 8 units a tile)
    const main = kind === 'beach' ? 'sand' : kind === 'playground' ? 'grass' : kind;
    const glow = kind === 'grid';
    const mat0 = new T.MeshStandardMaterial({ map: tile(main, (GROUND_R * 2) / 8), roughness: 0.95, metalness: 0 });
    if (glow) { mat0.emissive = new T.Color('#ffffff'); mat0.emissiveMap = mat0.map; mat0.emissiveIntensity = 0.7; }
    const beachR = land.beach ?? 14;
    g.add(disc2(0, kind === 'beach' ? beachR + 2 : GROUND_R, mat0, -0.004));
    if (kind === 'beach') {
      // water beyond the beach: reflective, with ripples, and a line of foam where it meets the sand
      const water = new T.MeshPhysicalMaterial({ color: new T.Color(P.sea), roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1 });
      water.normalMap = waveTex(); water.normalScale.set(0.5, 0.5);
      g.add(disc2(beachR, GROUND_R, water, -0.003, true));
      const foam = new T.RingGeometry(beachR - 0.35, beachR + 0.5, 128, 1); foam.rotateX(-Math.PI / 2);
      const fm = new T.Mesh(foam, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false })); fm.position.y = 0.001; g.add(fm);
    }
    if (kind === 'playground') {
      // a soft play surface under the scene, flecked like rubber crumb
      const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), r = rng(31); x.fillStyle = '#c0573e'; x.fillRect(0, 0, N, N);
      for (let i = 0; i < 6000; i++) { x.fillStyle = ['#a8462f', '#d9714f', '#2f9e44', '#1c7ed6', '#f59f00'][r() < 0.85 ? Math.floor(r() * 3) : 3 + Math.floor(r() * 2)]; x.fillRect(r() * N, r() * N, 2, 2); }
      const t3 = new T.CanvasTexture(c); t3.colorSpace = T.SRGBColorSpace; t3.wrapS = t3.wrapT = T.RepeatWrapping; t3.repeat.set(8, 8);
      g.add(disc2(0, land.beach ?? 12, new T.MeshStandardMaterial({ map: t3, roughness: 1 }), 0.006));
    }
    // the fade into the scenery: the front layer's colour, see-through near the scene and solid where the layers stand
    if (land.blend !== false && bd.layers && bd.layers.length) {
      const n = bd.layers.length, frontIdx = (() => { for (let i = n - 1; i >= 0; i--) { const l = bd.layers[i]; if (l.visible !== false && !BD.SKY.includes(l.kind) && !['sun', 'stars', 'planets'].includes(l.kind)) return i; } return -1; })();
      if (frontIdx >= 0) {
        const fl = bd.layers[frontIdx], fc = colourOf(fl, P, BD.distOf(frontIdx, n)), near = BD.NEAR * 0.5, far = BD.NEAR * 0.98;
        const geo = new T.RingGeometry(near, GROUND_R, 160, 40); geo.rotateX(-Math.PI / 2); if (kind !== 'beach') follow(geo, H, 0.03); geo.computeVertexNormals();
        const pos = geo.attributes.position, cols = new Float32Array(pos.count * 4);
        for (let i = 0; i < pos.count; i++) { const rr = Math.hypot(pos.getX(i), pos.getZ(i)), u = Math.max(0, Math.min(1, (rr - near) / (far - near))), a = u * u * (3 - 2 * u); cols.set([fc.r, fc.g, fc.b, (kind === 'beach' ? 0.5 : 0.92) * a], i * 4); }
        geo.setAttribute('color', new T.BufferAttribute(cols, 4));
        const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); m.position.y = 0.002; m.renderOrder = 1; g.add(m);
      }
    }
    buildFiller(g, land, kind, P, H);
    g.traverse((o) => { o.userData.backdrop = true; });
    return g;
  }
  let groundGroup = null;

  // ---------------------------------------------------------------- planets
  // a planet's surface as a wrap-round picture: banded gas giant, cratered rock, or a blue world with land and clouds
  function planetMap(kind, seed) {
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = rng(seed), img = x.createImageData(W, H), D = img.data;
    const k = [0, 1, 2, 3, 4, 5, 6, 7].map(() => r() * 6.28);
    // smooth noise on the sphere (from sines of the 3D point, so the left and right edges join)
    const nz = (px, py, pz, f) => Math.sin(px * f + k[0]) * Math.sin(py * f * 1.3 + k[1]) + Math.sin(py * f * 0.7 + pz * f * 1.1 + k[2]) * 0.6 + Math.sin(pz * f * 2.1 + px * f * 0.4 + k[3]) * 0.35 + Math.sin((px + py + pz) * f * 3.7 + k[4]) * 0.15;
    const pal = { gas: [[214, 168, 112], [180, 120, 80], [236, 214, 170], [150, 96, 70], [222, 190, 140]], ice: [[160, 210, 230], [120, 170, 210], [210, 235, 245], [90, 140, 190]], rock: [[150, 140, 130], [110, 100, 92], [175, 168, 158]], world: null }[kind] || [[180, 180, 180]];
    for (let j = 0; j < H; j++) {
      const lat = (j / H - 0.5) * Math.PI;
      for (let i = 0; i < W; i++) {
        const lon = (i / W) * Math.PI * 2, px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon), o = (j * W + i) * 4;
        let rgb;
        if (kind === 'gas' || kind === 'ice') { const t = (py + 0.08 * nz(px, py, pz, 4)) * 9 + 0.3 * nz(px, py, pz, 9), band = pal[Math.abs(Math.floor(t)) % pal.length], next = pal[Math.abs(Math.floor(t) + 1) % pal.length], f = t - Math.floor(t); rgb = band.map((v, q) => v + (next[q] - v) * f * f); }
        else if (kind === 'rock') { const n = nz(px, py, pz, 5) * 0.5 + nz(px, py, pz, 13) * 0.25; rgb = pal[0].map((v) => v * (0.85 + n * 0.2)); }
        else if (kind === 'moon') { const sea = nz(px, py, pz, 1.8) + 0.5 * nz(px, py, pz, 4.2), n = nz(px, py, pz, 11) * 0.06; rgb = [218, 218, 212].map((v) => v * (sea > 0.6 ? 0.66 : 0.97) * (1 + n)); }
        else { const land = nz(px, py, pz, 2.6) + 0.4 * nz(px, py, pz, 7); const ice = Math.abs(py) > 0.86; rgb = ice ? [240, 244, 248] : land > 0.55 ? (land > 1.1 ? [160, 140, 100] : [70, 140, 70]) : [30, 80, 160 + 30 * land]; const cl = nz(px * 1.3, py * 2.2, pz * 1.3, 4.5); if (cl > 0.75) rgb = rgb.map((v) => v + (255 - v) * Math.min(1, (cl - 0.75) * 2.5)); }
        D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; D[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    if (kind === 'rock' || kind === 'moon') for (let q = 0; q < 70; q++) { const cx = r() * W, cy = H * (0.15 + 0.7 * r()), rr = 4 + r() ** 2 * 30; x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(cx, cy, rr, rr * 0.9, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1 + rr * 0.08; x.beginPath(); x.ellipse(cx - 1, cy - 1, rr, rr * 0.9, 0, Math.PI * 0.9, Math.PI * 1.9); x.stroke(); }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8; tex.wrapS = T.RepeatWrapping; return tex;
  }
  // rings: soft bands, see-through between them
  function ringMap(seed) {
    const W = 512, c = document.createElement('canvas'); c.width = W; c.height = 4; const x = c.getContext('2d'), r = rng(seed + 5);
    for (let i = 0; i < W; i++) { const t = i / W, a = (0.25 + 0.6 * Math.abs(Math.sin(t * 23 + r() * 0.3)) * (0.6 + 0.4 * Math.sin(t * 7))) * Math.sin(t * Math.PI); x.fillStyle = `rgba(${220 - 40 * t},${205 - 50 * t},${180 - 50 * t},${a.toFixed(3)})`; x.fillRect(i, 0, 1, 4); }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
  }
  // a lit planet drawn flat (for Classic): the surface picture wrapped onto a disc, with day and night sides and a glow at the edge
  function planetDisc(map, R, bright = 1) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), out = x.createImageData(S, S), D = out.data;
    const src = map.image.getContext('2d').getImageData(0, 0, map.image.width, map.image.height), SD = src.data, SW = map.image.width, SH = map.image.height, L = new T.Vector3(-0.6, 0.5, 0.62).normalize();
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = (i / S) * 2 - 1, v = 1 - (j / S) * 2, rr = u * u + v * v, o = (j * S + i) * 4; if (rr > 1) continue;
      const z = Math.sqrt(1 - rr), lat = Math.asin(v), lon = Math.atan2(u, z) + 0.8, sx = Math.floor((((lon / (Math.PI * 2)) % 1) + 1) % 1 * SW), sy = Math.floor((0.5 - lat / Math.PI) * (SH - 1)), so = (sy * SW + sx) * 4;
      const lit = Math.max(0.12, u * L.x + v * L.y + z * L.z) * bright, rim = Math.pow(1 - z, 3) * 0.6;
      D[o] = Math.min(255, SD[so] * lit + 120 * rim); D[o + 1] = Math.min(255, SD[so + 1] * lit + 160 * rim); D[o + 2] = Math.min(255, SD[so + 2] * lit + 255 * rim); D[o + 3] = Math.min(255, 255 * Math.min(1, (1 - rr) * 60));
    }
    x.putImageData(out, 0, 0);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
  }
  function buildPlanets(g, l, d, per, style, bd) {
    const r = rng(l.seed), H = l.height ?? 1, n = 1 + Math.floor(r() * 3), kinds = ['gas', 'rock', 'world', 'ice'];
    for (let i = 0; i < n; i++) {
      const kind = kinds[Math.floor(r() * kinds.length)], R = d * (0.05 + 0.07 * r()) * (i ? 0.55 : 1), x = (r() - 0.5) * per * 0.6, y = d * (0.18 + 0.22 * r()) * H, ringed = kind !== 'world' && r() < 0.55, tilt = (r() - 0.5) * 0.7, map = planetMap(kind, l.seed + i * 17);
      if (style === 'classic') { const m = mesh(new T.CircleGeometry(R, 64).translate(x, y, 0), new T.MeshBasicMaterial({ map: planetDisc(map, R), transparent: true, alphaTest: 0.02 }), 0.01); g.add(m); }
      else { const s2 = new T.Mesh(new T.SphereGeometry(R, 64, 40), new T.MeshStandardMaterial({ map, roughness: kind === 'world' ? 0.6 : 0.9, metalness: 0 })); s2.position.set(x, y, 0); s2.rotation.set(0.2, r() * 6, tilt); g.add(s2); }
      if (ringed) {
        const ring = new T.RingGeometry(R * 1.35, R * 2.2, 96, 1), pos = ring.attributes.position, uv = ring.attributes.uv;
        for (let q = 0; q < pos.count; q++) { const rr = Math.hypot(pos.getX(q), pos.getY(q)); uv.setXY(q, (rr - R * 1.35) / (R * 0.85), 0.5); }
        const rm = new T.Mesh(ring, new T.MeshStandardMaterial({ map: ringMap(l.seed + i), transparent: true, side: T.DoubleSide, depthWrite: false, roughness: 1 }));
        rm.position.set(x, y, style === 'classic' ? 0.02 : 0); rm.rotation.set(style === 'classic' ? -1.3 : -1.25, 0, tilt); g.add(rm);
      }
    }
  }

  // ---------------------------------------------------------------- the sun, glows, and sky traffic
  function sunMap(col, digital, seed) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(seed + 9), base = new T.Color(col);
    if (digital) { const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff7ad9'); g.addColorStop(1, '#a23cff'); x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.fill(); }
    else {
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.55, '#' + base.clone().lerp(new T.Color('#ffffff'), 0.45).getHexString()); g.addColorStop(0.9, '#' + base.getHexString()); g.addColorStop(1, '#' + base.clone().lerp(new T.Color('#ff6a00'), 0.45).getHexString());
      x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.fill();
      // the mottled surface (granules), clipped to the disc
      x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); x.clip();
      for (let i = 0; i < 2600; i++) { const px = r() * S, py = r() * S, rr = 2 + r() * 5; x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(200,90,0,0.10)'; x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill(); }
      x.restore();
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function coronaMap(col, digital) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), base = new T.Color(digital ? '#ff7ad9' : col), rgb = `${Math.round(base.r * 255)},${Math.round(base.g * 255)},${Math.round(base.b * 255)}`;
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.14, S / 2, S / 2, S / 2); g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(0.35, `rgba(${rgb},0.18)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    if (!digital) { x.translate(S / 2, S / 2); for (let i = 0; i < 24; i++) { x.rotate((Math.PI * 2) / 24); const len = S * (0.3 + 0.16 * ((i * 7) % 5) / 5), gr = x.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(${rgb},0.22)`); gr.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = gr; x.beginPath(); x.moveTo(S * 0.14, -3); x.lineTo(len, 0); x.lineTo(S * 0.14, 3); x.fill(); } }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function glowMap(colour) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), b = new T.Color(colour), rgb = `${Math.round(b.r * 255)},${Math.round(b.g * 255)},${Math.round(b.b * 255)}`;
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2); g.addColorStop(0, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  // a fading streak (white in front, see-through at the back), for contrails and shooting-star tails
  function streakMap() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 16; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.95)'); x.fillStyle = g; x.fillRect(0, 0, 256, 16);
    const vg = x.createLinearGradient(0, 0, 0, 16); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = vg; x.fillRect(0, 0, 256, 16);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  const std = (color, o = {}) => new T.MeshStandardMaterial({ color: new T.Color(color), roughness: o.rough ?? 0.5, metalness: o.metal ?? 0.1, emissive: new T.Color(o.glow ? color : '#000000'), emissiveIntensity: o.glow ? 1.5 : 0 });
  // little detailed craft for the sky (pointing along +x)
  function airliner(L) {
    const g = new T.Group(), white = std('#f4f6f8', { rough: 0.35 }), grey = std('#9aa3ad'), dark = std('#2b3440');
    const body = new T.Mesh(new T.CapsuleGeometry(L * 0.055, L * 0.85, 6, 16), white); body.rotation.z = Math.PI / 2; g.add(body);
    const wing = new T.Shape(); wing.moveTo(0, 0); wing.lineTo(-L * 0.18, L * 0.42); wing.lineTo(-L * 0.28, L * 0.42); wing.lineTo(-L * 0.16, 0); wing.closePath();
    [1, -1].forEach((sd) => { const w = new T.Mesh(new T.ExtrudeGeometry(wing, { depth: L * 0.012, bevelEnabled: false }), grey); w.rotation.x = sd > 0 ? -Math.PI / 2 : Math.PI / 2; w.position.set(L * 0.05, -L * 0.02, 0); g.add(w);
      const eng = new T.Mesh(new T.CylinderGeometry(L * 0.025, L * 0.025, L * 0.1, 12), grey); eng.rotation.z = Math.PI / 2; eng.position.set(L * 0.02, -L * 0.06, sd * L * 0.17); g.add(eng); });
    const fin = new T.Shape(); fin.moveTo(0, 0); fin.lineTo(-L * 0.08, L * 0.2); fin.lineTo(-L * 0.14, L * 0.2); fin.lineTo(-L * 0.12, 0); fin.closePath();
    const f = new T.Mesh(new T.ExtrudeGeometry(fin, { depth: L * 0.01, bevelEnabled: false }), std('#1c7ed6')); f.position.set(-L * 0.36, L * 0.04, -L * 0.005); g.add(f);
    const tail = new T.Shape(); tail.moveTo(0, 0); tail.lineTo(-L * 0.06, L * 0.14); tail.lineTo(-L * 0.11, L * 0.14); tail.lineTo(-L * 0.09, 0); tail.closePath();
    [1, -1].forEach((sd) => { const t2 = new T.Mesh(new T.ExtrudeGeometry(tail, { depth: L * 0.008, bevelEnabled: false }), grey); t2.rotation.x = sd > 0 ? -Math.PI / 2 : Math.PI / 2; t2.position.set(-L * 0.37, L * 0.03, 0); g.add(t2); });
    for (let i = 0; i < 12; i++) [1, -1].forEach((sd) => { const w2 = new T.Mesh(new T.BoxGeometry(L * 0.018, L * 0.014, L * 0.004), dark); w2.position.set(L * 0.32 - i * L * 0.05, L * 0.012, sd * L * 0.055); g.add(w2); });
    return g;
  }
  function spaceship(L) {
    const g = new T.Group(), hull = std('#d0d6de', { metal: 0.6, rough: 0.3 }), trim = std('#e03131'), glow = std('#66d9ff', { glow: true });
    const body = new T.Mesh(new T.ConeGeometry(L * 0.09, L * 0.8, 16), hull); body.rotation.z = -Math.PI / 2; g.add(body);
    const pod = new T.Mesh(new T.CapsuleGeometry(L * 0.07, L * 0.3, 4, 12), hull); pod.rotation.z = Math.PI / 2; pod.position.x = -L * 0.3; g.add(pod);
    [1, -1].forEach((sd) => { const fin = new T.Mesh(new T.BoxGeometry(L * 0.22, L * 0.012, L * 0.18), trim); fin.position.set(-L * 0.3, 0, sd * L * 0.12); fin.rotation.y = sd * 0.35; g.add(fin); });
    const cock = new T.Mesh(new T.SphereGeometry(L * 0.05, 12, 8), std('#1b2a3a', { rough: 0.1 })); cock.position.set(L * 0.05, L * 0.05, 0); g.add(cock);
    const engine = new T.Mesh(new T.SphereGeometry(L * 0.07, 12, 8), glow); engine.position.x = -L * 0.48; g.add(engine);
    return g;
  }
  function airship(L) {
    const g = new T.Group(), skin = std('#c9cdd3', { metal: 0.35, rough: 0.4 }), red = std('#c92a2a');
    const env = new T.Mesh(new T.SphereGeometry(L * 0.5, 32, 16), skin); env.scale.set(1, 0.3, 0.3); g.add(env);
    const band = new T.Mesh(new T.SphereGeometry(L * 0.501, 32, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.08), red); band.scale.set(1, 0.3, 0.3); g.add(band);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => { const fin = new T.Mesh(new T.BoxGeometry(L * 0.16, L * 0.012, L * 0.1), red); fin.position.set(-L * 0.42, a * 0 + b * L * 0.1, a * L * 0.1); fin.rotation.x = a ? Math.PI / 2 : 0; g.add(fin); });
    const gond = new T.Mesh(new T.CapsuleGeometry(L * 0.03, L * 0.14, 4, 8), std('#3b3f45')); gond.rotation.z = Math.PI / 2; gond.position.set(L * 0.05, -L * 0.17, 0); g.add(gond);
    return g;
  }
  // sky traffic: each piece crosses the sky on a path that repeats a whole number of times in the animation's length,
  // so loops stay seamless; shooting stars flash across now and then
  function buildTraffic(g, l, d, per, P) {
    const r = rng(l.seed), W = per * 1.1, tail = streakMap();
    g.userData.traffic = true;
    const add = (obj, o) => { obj.userData.fly = { W, ...o }; obj.traverse((x) => { x.castShadow = false; }); g.add(obj); };
    for (let i = 0; i < (l.planes ?? 2); i++) { const L = d * 0.065, a = airliner(L), trail = mesh(new T.PlaneGeometry(L * 6, L * 0.06).translate(-L * 3.4, 0, 0), new T.MeshBasicMaterial({ map: tail, transparent: true, depthWrite: false, opacity: 0.8 })); a.add(trail); add(a, { base: 16, y: d * (0.28 + 0.14 * r()), off: r(), dir: r() < 0.5 ? 1 : -1, tilt: 0 }); }
    for (let i = 0; i < (l.ships ?? 1); i++) { const L = d * 0.07, sp = spaceship(L), trail = mesh(new T.PlaneGeometry(L * 3, L * 0.1).translate(-L * 2, 0, 0), new T.MeshBasicMaterial({ map: tail, color: '#66d9ff', transparent: true, depthWrite: false })); sp.add(trail); add(sp, { base: 8, y: d * (0.32 + 0.16 * r()), off: r(), dir: r() < 0.5 ? 1 : -1, tilt: 0.05 }); }
    for (let i = 0; i < (l.airships ?? 1); i++) add(airship(d * 0.14), { base: 40, y: d * (0.2 + 0.08 * r()), off: r(), dir: r() < 0.5 ? 1 : -1, tilt: 0 });
    for (let i = 0; i < (l.stars ?? 3); i++) {
      const L = d * 0.14, st = new T.Group();
      st.add(mesh(new T.PlaneGeometry(L, L * 0.02).translate(-L / 2, 0, 0), new T.MeshBasicMaterial({ map: tail, transparent: true, depthWrite: false, toneMapped: false })));
      st.add(mesh(new T.SphereGeometry(L * 0.012, 8, 6), new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })));
      add(st, { base: 5, y: d * (0.4 + 0.15 * r()), off: r(), dir: r() < 0.5 ? 1 : -1, tilt: -0.45, flash: true, x0: (r() - 0.5) * per * 0.6 });
    }
  }
  function poseTraffic(g, t) {
    const len = (E.anim && E.anim() && E.anim().length) || 5;
    g.children.forEach((o) => {
      const f = o.userData.fly; if (!f) return;
      const k = Math.max(1, Math.round(len / f.base)), dur = len / k, u = ((t / dur + f.off) % 1 + 1) % 1;
      o.rotation.set(0, f.dir > 0 ? 0 : Math.PI, f.dir > 0 ? f.tilt : f.tilt);
      if (f.flash) {
        // a quick streak across part of the sky, then gone until next time
        const on = u < 0.25, v = u / 0.25; o.visible = on;
        o.position.set(f.x0 + f.dir * (v - 0.5) * f.W * 0.35, f.y - v * f.W * 0.12, 0.5);
        o.traverse((x) => { if (x.material) { x.material.transparent = true; x.material.opacity = Math.sin(v * Math.PI); } });
      } else { o.position.set(f.dir * (u - 0.5) * f.W, f.y, 0.5); o.visible = true; }
    });
  }

  // ---------------------------------------------------------------- in the scene
  let group = null, built = '', center = new T.Vector3();
  BD.sync = function (force) {
    const scene = E.scene && E.scene(); if (!scene) return;
    const bd = BD.get(), land = BD.land(), sig = JSON.stringify([bd, land]);
    if (!force && sig === built && group) { BD.pose(E.time); return; }
    built = sig;
    if (group) { group.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); [].concat(x.material).forEach((m) => m.dispose()); } }); scene.remove(group); group = null; }
    const floor = scene.getObjectByName('floor'); if (floor) floor.scale.setScalar(bd && bd.on ? 2.2 : 1);
    if (groundGroup) { groundGroup.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); [].concat(x.material).forEach((m) => { if (m.map && m.map !== waveTex()) m.map.dispose(); m.dispose(); }); } }); groundGroup.removeFromParent(); groundGroup = null; }
    // the matching ground takes the place of the plain floor (and sits in the scene's ground, so Ground: None hides it)
    const wantGround = !!(land && land.on && floor);
    if (E.groundOverride !== wantGround) { E.groundOverride = wantGround; E.applyScene(); }
    { const box = new T.Box3().setFromObject(E.root()); center = box.isEmpty() ? new T.Vector3() : box.getCenter(new T.Vector3()); center.y = 0; }
    // distance haze: far things fade into the sky's haze colour (not in ray-traced renders)
    const hz = land ? land.haze || 0 : 0, hazeCol = new T.Color(bd && bd.on ? (BD.PALETTES[bd.palette] || BD.PALETTES.day)[1].haze : '#d9e2ec');
    scene.fog = hz > 0 ? new T.Fog(hazeCol, 20 + (1 - hz) * 90, 140 + (1 - hz) * 260) : null;
    if (wantGround) { groundGroup = buildGround(bd && bd.on ? bd : { palette: 'day', layers: [], theme: null }); groundGroup.position.set(center.x, 0, center.z); floor.parent.add(groundGroup); }
    if (!bd || !bd.on) { E.redraw && E.redraw(); return; }
    group = new T.Group(); group.name = 'backdrop';
    const n = bd.layers.length;
    bd.layers.forEach((l, i) => { if (l.visible === false) return; const d = BD.distOf(i, n), g = buildLayer(l, bd, d); g.position.z = -d; group.add(g); });
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
      if (g.userData.traffic) poseTraffic(g, t);
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
