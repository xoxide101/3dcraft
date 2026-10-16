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
  };
  // palettes: the sky (top, horizon), the haze far layers fade into, and a colour for each kind
  BD.PALETTES = {
    day: ['Day', { sky: ['#6fb0ee', '#e4f1fb'], haze: '#d6e7f5', sun: '#ffd84d', stars: '#ffffff', clouds: '#ffffff', mountains: '#7486a3', hills: '#64ad55', trees: '#2c7339', city: '#56677c', sea: '#2f86c8', windows: '#3a4a5c', lit: false }],
    sunset: ['Sunset', { sky: ['#ff7a59', '#ffd59e'], haze: '#f7b48e', sun: '#fff0a0', stars: '#fff4e0', clouds: '#ffc0a4', mountains: '#7a4f74', hills: '#a3566b', trees: '#4b2e4f', city: '#3c2a46', sea: '#d9775c', windows: '#ffd27a', lit: true }],
    night: ['Night', { sky: ['#070b1e', '#22325e'], haze: '#273763', sun: '#eef1f6', stars: '#ffffff', clouds: '#56678a', mountains: '#1d2846', hills: '#18352f', trees: '#0e221e', city: '#141a2d', sea: '#13305a', windows: '#ffd86b', lit: true }],
    desert: ['Desert', { sky: ['#f2b56b', '#fdebc8'], haze: '#f2d7ad', sun: '#fff3c4', stars: '#ffffff', clouds: '#fff6e8', mountains: '#b8704a', hills: '#e2a868', trees: '#6f8a35', city: '#a46f4c', sea: '#3fa7a0', windows: '#5a4030', lit: false }],
    storm: ['Storm', { sky: ['#343b4a', '#8b95a7'], haze: '#97a1b0', sun: '#d8dee9', stars: '#e5e9f0', clouds: '#6b7280', mountains: '#4b5563', hills: '#4c6848', trees: '#2b3b2a', city: '#384150', sea: '#3c596b', windows: '#cfd6e0', lit: false }],
  };
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
  // ready-made sets for New backdrop: [layers, palettes that suit them]
  const SETS = [
    [['sun', 'clouds', 'mountains', 'hills', 'trees'], ['day', 'sunset', 'storm']],
    [['sun', 'clouds', 'city', ['city', { height: 0.8 }]], ['day', 'sunset', 'night']],
    [['sun', 'clouds', 'mountains', 'sea'], ['day', 'sunset']],
    [['sun', 'mountains', 'hills', ['hills', { height: 0.7 }]], ['desert']],
    [['stars', 'sun', 'city', ['city', { height: 0.8 }]], ['night']],
    [['stars', 'sun', 'mountains', 'trees', 'sea'], ['night', 'sunset']],
  ];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  BD.random = function () {
    const bd = BD.ensure(), [kinds, pals] = pick(SETS);
    bd.on = true; bd.palette = pick(pals);
    bd.layers = kinds.map((k) => (Array.isArray(k) ? BD.newLayer(k[0], k[1]) : BD.newLayer(k)));
    BD.applyPalette(bd.palette);
  };
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
    const base = new T.Color(P[l.kind] || '#888888'), f = (0.15 + 0.55 * Math.max(0, Math.min(1, (d - BD.NEAR) / (BD.FAR - BD.NEAR)))) * (l.haze ?? 1);
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
    } else if (l.kind === 'stars') {
      const r = rng(l.seed), list = [], n = Math.round(per * 1.4);
      for (let k = -1; k <= 1; k++) for (let i = 0; i < n; i++) { const rr = d * (0.0015 + 0.003 * r() ** 3); list.push(new T.CircleGeometry(rr, 6).translate((r() - 0.5) * per + k * per, d * (0.06 + 0.55 * r()) * (l.height ?? 1), 0)); }
      g.add(mesh(merge(list), new T.MeshBasicMaterial({ color: col })));
    } else if (l.kind === 'sun') {
      const r = rng(l.seed), x = (r() - 0.5) * per * 0.5, y = d * (0.16 + 0.14 * r()) * (l.height ?? 1), rad = d * 0.045;
      const moon = bd.palette === 'night';
      if (style === 'modern') g.add(mesh(new T.SphereGeometry(rad, 40, 24).translate(x, y, 0), new T.MeshBasicMaterial({ color: col })));
      else g.add(mesh(new T.CircleGeometry(rad, 64).translate(x, y, 0), new T.MeshBasicMaterial({ color: col })));
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
