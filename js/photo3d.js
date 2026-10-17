/* 3DCraft photos to 3D (window.PHOTO3D): photos of an object turned on a turntable in front of a plain background are
   cut out (each silhouette), a block of voxels is carved from every angle (whatever falls outside a silhouette is cut
   away), the result is smoothed into a mesh (surface nets) and painted with colours from the photo that faces each point
   most. It is saved as a coloured PLY inside the scene, so it lights, animates, renders and exports like any model.
   Good for toys, figures, fruit and simple shapes; deep hollows (the inside of a cup) cannot be seen from outside. */
(function () {
  'use strict';
  const T = window.THREE;

  // a picture's silhouette: see-through where it matches the background colour (taken from the corners)
  // a photo's silhouette: what is left after the background remover (see-through = background)
  async function silhouetteOf(src, maxW, o) {
    const cut = await BGREMOVE.remove(src, { ...(o.bg || { mode: 'auto', tolerance: o.tolerance ?? 40 }), max: maxW });
    return silhouette(cut.canvas, maxW, -1);
  }
  function silhouette(img, maxW, tol) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, maxW / iw), W = Math.round(iw * k), H = Math.round(ih * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const D = x.getImageData(0, 0, W, H).data, at = (u, v) => (v * W + u) * 4, cs = [at(1, 1), at(W - 2, 1), at(1, H - 2), at(W - 2, H - 2)];
    const bg = [0, 1, 2].map((q) => cs.reduce((s, i) => s + D[i + q], 0) / 4), mask = new Uint8Array(W * H);
    // tol < 0: the picture is already cut out (its see-through parts are the background)
    for (let i = 0; i < W * H; i++) mask[i] = tol < 0 ? (D[i * 4 + 3] > 128 ? 1 : 0) : Math.hypot(D[i * 4] - bg[0], D[i * 4 + 1] - bg[1], D[i * 4 + 2] - bg[2]) > tol ? 1 : 0;
    // close little holes and specks: keep a pixel if most of its neighbours agree
    const m2 = new Uint8Array(W * H);
    for (let v = 1; v < H - 1; v++) for (let u = 1; u < W - 1; u++) { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) n += mask[(v + j) * W + u + i]; m2[v * W + u] = n >= 5 ? 1 : 0; }
    let x0 = W, x1 = -1, y0 = H, y1 = -1, sx = 0, n = 0;
    for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) if (m2[v * W + u]) { if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; sx += u; n++; }
    return { W, H, mask: m2, rgb: D, x0, x1, y0, y1, cx: n ? sx / n : W / 2, n };
  }

  // Carve: views[i] seen from angle a_i round the up axis. Orthographic: image x is the sideways position, image y is height.
  function carve(views, res, dir) {
    const N = views.length, step = (Math.PI * 2) / N * (dir === 'cw' ? -1 : 1);
    // a common axis (the turntable's middle) and scale: all photos come from the same still camera
    const axis = views.reduce((s, v) => s + (v.x0 + v.x1) / 2, 0) / N, top = Math.min(...views.map((v) => v.y0)), bot = Math.max(...views.map((v) => v.y1));
    const half = Math.max(...views.map((v) => Math.max(axis - v.x0, v.x1 - axis))) + 2, height = bot - top + 4;
    const big = Math.max(half * 2, height), cell = big / res, nx = Math.ceil((half * 2) / cell) + 2, ny = Math.ceil(height / cell) + 2, nz = nx;
    const grid = new Uint8Array(nx * ny * nz).fill(1), id = (i, j, k) => (k * ny + j) * nx + i;
    const cos = views.map((_, i) => Math.cos(i * step)), sin = views.map((_, i) => Math.sin(i * step));
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const X = (i - nx / 2 + 0.5) * cell, Z = (k - nz / 2 + 0.5) * cell;
      for (let j = 0; j < ny; j++) {
        if (i === 0 || k === 0 || j === 0 || i === nx - 1 || k === nz - 1 || j === ny - 1) { grid[id(i, j, k)] = 0; continue; }
        const py = Math.round(bot + 2 - (j + 0.5) * cell);
        for (let q = 0; q < N; q++) {
          const v = views[q], px = Math.round(axis + X * cos[q] + Z * sin[q]);
          if (px < 0 || py < 0 || px >= v.W || py >= v.H || !v.mask[py * v.W + px]) { grid[id(i, j, k)] = 0; break; }
        }
      }
    }
    return { grid, nx, ny, nz, cell, axis, bot, cos, sin };
  }

  // Hollows from AI depth: carving only sees outlines, so a dent, the gap under an arm or the hole of a ring lying flat
  // stays filled. Each photo's depth map (CRAFTAI.depth, 0 far – 1 near, no real scale) is lined up with the carved
  // shape's own front surface as seen from that photo (a straight-line fit, done twice, the worst-fitting fifth left out
  // the second time); where the depth says the surface is clearly further back than the carving, the cells in front
  // of it get a vote; a cell goes only when enough photos agree (one photo's depth can be wrong, several rarely are).
  // strength 0–1: how far the depth is trusted.
  function hollows(c, views, depths, strength) {
    const { grid, nx, ny, nz, cell, axis, bot, cos, sin } = c, id = (i, j, k) => (k * ny + j) * nx + i;
    let removed = 0; const votes = new Uint8Array(grid.length);
    views.forEach((v, q) => {
      const dm = depths[q]; if (!dm) return;
      const front = new Float32Array(v.W * v.H).fill(-Infinity), at = (px, py) => py * v.W + px;
      const proj = (i, j, k) => { const X = (i - nx / 2 + 0.5) * cell, Z = (k - nz / 2 + 0.5) * cell; return [Math.round(axis + X * cos[q] + Z * sin[q]), Math.round(bot + 2 - (j + 0.5) * cell), Z * cos[q] - X * sin[q]]; };
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        if (!grid[id(i, j, k)]) continue; const [px, py, n] = proj(i, j, k);
        if (px >= 0 && py >= 0 && px < v.W && py < v.H && n > front[at(px, py)]) front[at(px, py)] = n;
      }
      // the depth model's answer at each photo pixel, against the carving's front there
      const xs = [], ys = [], ps = [];
      for (let py = 0; py < v.H; py++) for (let px = 0; px < v.W; px++) {
        const f = front[at(px, py)]; if (f === -Infinity || !v.mask[at(px, py)]) continue;
        const d = dm.d[Math.min(dm.H - 1, Math.floor(((py + 0.5) * dm.H) / v.H)) * dm.W + Math.min(dm.W - 1, Math.floor(((px + 0.5) * dm.W) / v.W))];
        xs.push(d); ys.push(f); ps.push(at(px, py));
      }
      if (xs.length < 50) return;
      const fit = (use) => { let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; for (let t = 0; t < xs.length; t++) { if (use && !use[t]) continue; n++; sx += xs[t]; sy += ys[t]; sxx += xs[t] * xs[t]; sxy += xs[t] * ys[t]; } const a = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx); return [a, (sy - a * sx) / n]; };
      let [a, b] = fit(null);
      const res = xs.map((x, t) => Math.abs(a * x + b - ys[t])), cut = [...res].sort((p, r) => p - r)[Math.floor(res.length * 0.8)];
      [a, b] = fit(res.map((r) => r <= cut));
      if (!(a > 0)) return; // the depth does not agree with the shape at all: leave this view out
      // the surface the depth points to; cells clearly in front of it (and behind the carving's front) go
      const surf = new Float32Array(v.W * v.H).fill(Infinity), margin = cell * 1.5;
      ps.forEach((p, t) => { const want = a * xs[t] + b, f = ys[t]; if (f - want > margin * 1.3) surf[p] = f - (f - want) * strength; });
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const o = id(i, j, k); if (!grid[o]) continue; const [px, py, n] = proj(i, j, k);
        if (px < 0 || py < 0 || px >= v.W || py >= v.H) continue;
        const s = surf[at(px, py)]; if (s !== Infinity && n > s + margin && votes[o] < 255) votes[o]++;
      }
    });
    const need = Math.max(2, Math.round(views.length / 10));
    for (let o = 0; o < grid.length; o++) if (grid[o] && votes[o] >= need) { grid[o] = 0; removed++; }
    return removed;
  }

  // Surface nets: a point inside each cell where the inside and outside meet, joined into four-sided faces; a light
  // smoothing of the field first rounds off the blocky voxel steps
  function mesh(c, smooth) {
    const { nx, ny, nz } = c, id = (i, j, k) => (k * ny + j) * nx + i;
    let f = Float32Array.from(c.grid);
    for (let pass = 0; pass < smooth; pass++) {
      const g = new Float32Array(f.length);
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const o = id(i, j, k); g[o] = (f[o] * 2 + f[o - 1] + f[o + 1] + f[o - nx] + f[o + nx] + f[o - nx * ny] + f[o + nx * ny]) / 8; }
      f = g;
    }
    const iso = 0.5, vIndex = new Int32Array(nx * ny * nz).fill(-1), pos = [];
    const cornersOf = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const val = cornersOf.map(([a, b, d]) => f[id(i + a, j + b, k + d)]); let inside = 0; val.forEach((v) => { if (v > iso) inside++; });
      if (inside === 0 || inside === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      edges.forEach(([a, b]) => { const va = val[a], vb = val[b]; if ((va > iso) === (vb > iso)) return; const t = (iso - va) / (vb - va), A = cornersOf[a], B = cornersOf[b]; sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++; });
      vIndex[id(i, j, k)] = pos.length / 3; pos.push(i + sx / n, j + sy / n, k + sz / n);
    }
    const tri = [];
    const quad = (a, b, c2, d, flip) => { if (a < 0 || b < 0 || c2 < 0 || d < 0) return; if (flip) tri.push(a, c2, b, a, d, c2); else tri.push(a, b, c2, a, c2, d); };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const o = id(i, j, k), here = f[o] > iso;
      if (here !== (f[o + 1] > iso)) quad(vIndex[id(i, j - 1, k - 1)], vIndex[id(i, j, k - 1)], vIndex[id(i, j, k)], vIndex[id(i, j - 1, k)], !here);
      if (here !== (f[o + nx] > iso)) quad(vIndex[id(i - 1, j, k - 1)], vIndex[id(i - 1, j, k)], vIndex[id(i, j, k)], vIndex[id(i, j, k - 1)], !here);
      if (here !== (f[o + nx * ny] > iso)) quad(vIndex[id(i - 1, j - 1, k)], vIndex[id(i, j - 1, k)], vIndex[id(i, j, k)], vIndex[id(i - 1, j, k)], !here);
    }
    return { pos, tri };
  }

  // colours: each point takes its colour from the photo that faces it most squarely
  function colour(c, views, pos, tri) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(tri); g.computeVertexNormals();
    const nrm = g.attributes.normal, N = views.length, cols = new Uint8Array(pos.length);
    for (let p = 0; p < pos.length / 3; p++) {
      const X = (pos[p * 3] - c.nx / 2) * c.cell, Y = pos[p * 3 + 1], Z = (pos[p * 3 + 2] - c.nz / 2) * c.cell, nX = nrm.getX(p), nZ = nrm.getZ(p);
      // view q's sideways axis is (cos, 0, sin), so its camera sits towards (-sin, 0, cos): pick the view facing the point most
      let best = 0, bestDot = -2;
      for (let q = 0; q < N; q++) { const d = nZ * c.cos[q] - nX * c.sin[q]; if (d > bestDot) { bestDot = d; best = q; } }
      const v = views[best], px = Math.round(c.axis + X * c.cos[best] + Z * c.sin[best]), py = Math.round(c.bot + 2 - Y * c.cell);
      const o = (Math.max(0, Math.min(v.H - 1, py)) * v.W + Math.max(0, Math.min(v.W - 1, px))) * 4;
      cols[p * 3] = v.rgb[o]; cols[p * 3 + 1] = v.rgb[o + 1]; cols[p * 3 + 2] = v.rgb[o + 2];
    }
    return cols;
  }

  // a binary PLY (positions in cells, colours, triangles), so the result is kept in the scene like any scan
  function toPLY(pos, cols, tri, c) {
    const nv = pos.length / 3, nf = tri.length / 3;
    const head = `ply\nformat binary_little_endian 1.0\ncomment made by 3DCraft photos to 3D\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
    const hb = new TextEncoder().encode(head), buf = new ArrayBuffer(hb.length + nv * 15 + nf * 13), dv = new DataView(buf); new Uint8Array(buf).set(hb);
    let o = hb.length;
    for (let p = 0; p < nv; p++) { dv.setFloat32(o, (pos[p * 3] - c.nx / 2) * c.cell, true); dv.setFloat32(o + 4, pos[p * 3 + 1] * c.cell, true); dv.setFloat32(o + 8, (pos[p * 3 + 2] - c.nz / 2) * c.cell, true); dv.setUint8(o + 12, cols[p * 3]); dv.setUint8(o + 13, cols[p * 3 + 1]); dv.setUint8(o + 14, cols[p * 3 + 2]); o += 15; }
    for (let f = 0; f < nf; f++) { dv.setUint8(o, 3); dv.setInt32(o + 1, tri[f * 3], true); dv.setInt32(o + 5, tri[f * 3 + 1], true); dv.setInt32(o + 9, tri[f * 3 + 2], true); o += 13; }
    return buf;
  }

  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('A photo could not be read.')); i.src = src; });
  // photos: data URLs in the order they were taken; o = { detail: 64 | 96 | 128 | 160, tolerance, smooth, dir: 'ccw' | 'cw' }
  async function build(photos, o = {}, onStep = () => {}) {
    if (photos.length < 4) throw new Error('Choose at least 4 photos (12 to 36 works best), taken while turning the object evenly all the way round.');
    onStep('Cutting out the photos…'); await new Promise((r) => setTimeout(r, 20));
    const views = []; for (const ph of photos) views.push(await silhouetteOf(ph, 480, o));
    if (views.some((v) => v.n < 50)) throw new Error('In some photos nothing stood out from the background: use a plain background, or change the tolerance.');
    onStep('Carving the shape from every angle…'); await new Promise((r) => setTimeout(r, 20));
    const c = carve(views, o.detail || 96, o.dir);
    if (o.depthHollows && window.CRAFTAI && CRAFTAI.enabled('depth')) {
      const depths = [];
      for (let q = 0; q < photos.length; q++) { onStep(`Working out the depth in each photo (AI): ${q + 1} of ${photos.length}…`); depths.push(await CRAFTAI.depth(photos[q])); }
      onStep('Finding the hollows…'); await new Promise((r) => setTimeout(r, 20));
      hollows(c, views, depths, o.depthHollows);
    }
    onStep('Smoothing it into a surface…'); await new Promise((r) => setTimeout(r, 20));
    const { pos, tri } = mesh(c, o.smooth ?? 2);
    if (!tri.length) throw new Error('Nothing was left after carving: are the photos in order, all the way round, with the camera kept still?');
    onStep('Painting it with the photos…'); await new Promise((r) => setTimeout(r, 20));
    const cols = colour(c, views, pos, tri);
    return { ply: toPLY(pos, cols, tri, c), triangles: tri.length / 3 };
  }
  // One photo: a guess at the shape by puffing the silhouette up like a balloon (thick in the middle, round to thin edges,
  // from each point's distance to the edge), plus some of the photo's light and dark as bumps if asked. The back is the
  // same (or flat, for standing on a printer's bed). o = { detail (cells across), tolerance, puff, shading, flatBack,
  // shape: 'puff' | 'depth' (AI works out how near each part is, CRAFTAI.depth) | 'both' }
  async function build1(photo, o = {}, onStep = () => {}) {
    onStep('Cutting out the photo…'); await new Promise((r) => setTimeout(r, 20));
    const res = o.detail || 160, v = await silhouetteOf(photo, res * 1.6, o);
    if (v.n < 50) throw new Error('Nothing stood out from the background: use a photo on a plain background, or change the tolerance.');
    const W = v.x1 - v.x0 + 3, H = v.y1 - v.y0 + 3, inside = (u, w) => u >= 0 && w >= 0 && u < W && w < H && v.mask[(w + v.y0 - 1) * v.W + (u + v.x0 - 1)] === 1;
    // distance to the edge (two passes, 3-4 chamfer)
    const INF = 1e9, d = new Float32Array(W * H);
    for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) d[w * W + u] = inside(u, w) ? INF : 0;
    for (let w = 1; w < H; w++) for (let u = 1; u < W - 1; u++) { const o2 = w * W + u; if (!d[o2]) continue; d[o2] = Math.min(d[o2], d[o2 - 1] + 3, d[o2 - W] + 3, d[o2 - W - 1] + 4, d[o2 - W + 1] + 4); }
    for (let w = H - 2; w >= 0; w--) for (let u = W - 2; u > 0; u--) { const o2 = w * W + u; if (!d[o2]) continue; d[o2] = Math.min(d[o2], d[o2 + 1] + 3, d[o2 + W] + 3, d[o2 + W + 1] + 4, d[o2 + W - 1] + 4); }
    let maxD = 0; for (let i = 0; i < d.length; i++) { d[i] /= 3; if (d[i] > maxD) maxD = d[i]; }
    // AI depth: how near each part of the photo is (0 far – 1 near), stretched to the nearest and farthest parts of the shape
    const mix = o.shape === 'depth' ? 1 : o.shape === 'both' ? 0.5 : 0;
    let near = null;
    if (mix) {
      onStep('Working out the depth (AI)…');
      const dm = await CRAFTAI.depth(photo); near = new Float32Array(W * H); let lo = Infinity, hi = -Infinity;
      for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) {
        if (!d[w * W + u]) continue;
        const X = Math.min(dm.W - 1, Math.floor(((u + v.x0 - 1 + 0.5) * dm.W) / v.W)), Y = Math.min(dm.H - 1, Math.floor(((w + v.y0 - 1 + 0.5) * dm.H) / v.H)), z = dm.d[Math.max(0, Y) * dm.W + Math.max(0, X)];
        near[w * W + u] = z; if (z < lo) lo = z; if (z > hi) hi = z;
      }
      const k = 1 / Math.max(1e-6, hi - lo); for (let i = 0; i < near.length; i++) if (d[i]) near[i] = (near[i] - lo) * k;
    }
    onStep(mix ? 'Shaping it from the depth…' : 'Puffing it up…'); await new Promise((r) => setTimeout(r, 20));
    // the edge: its shape (round, angled, square, puffy) and how far in it reaches (a narrow edge with a flat top, up to
    // the whole shape); thickness is how tall it is, compared with the shape's own size
    const puff = o.puff ?? 1, shade = o.shading ?? 0.3, edge = o.edge || 'round', reach = Math.max(0.03, Math.min(1, o.reach ?? 1));
    const band = Math.max(1.5, maxD * reach), top = maxD * 0.55 * puff, h = new Float32Array(W * H), at = (u, w) => (((w + v.y0 - 1) * v.W) + (u + v.x0 - 1)) * 4;
    const PROFILE = { round: (x) => Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x))), angled: (x) => x, square: (x) => (x > 0 ? 1 : 0), puffy: (x) => Math.pow(Math.sin((x * Math.PI) / 2), 0.45) };
    const prof = PROFILE[edge] || PROFILE.round;
    for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) {
      const o2 = w * W + u; if (!d[o2]) continue;
      const t = Math.max(0, d[o2] - 1), x = Math.min(1, t / band), q = at(u, w), lum = (0.299 * v.rgb[q] + 0.587 * v.rgb[q + 1] + 0.114 * v.rgb[q + 2]) / 255;
      // depth: the nearest part stands out by the thickness, the farthest a little; it eases to nothing at the very edge so
      // the front and back still meet
      const dz = near ? maxD * 1.1 * puff * (0.18 + 0.82 * near[o2]) * Math.sqrt(Math.min(1, t / Math.max(2, maxD * 0.12))) : 0;
      h[o2] = top * prof(x) * (1 - mix) + dz * mix + lum * maxD * shade * 0.5 * Math.min(1, t / 3);
    }
    // front and back sheets over the cut-out pixels, joined at the edge
    const id = new Int32Array(W * H).fill(-1), pos = [], cols = [], tri = [];
    for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) { const o2 = w * W + u; if (!d[o2]) continue; id[o2] = pos.length / 3; const q = at(u, w); pos.push(u - W / 2, H - w, h[o2]); cols.push(v.rgb[q], v.rgb[q + 1], v.rgb[q + 2]); }
    // the back: its own points, except round the edge (height 0), where front and back share points so the shape is closed
    const nFront = pos.length / 3, back = new Int32Array(nFront);
    for (let i = 0; i < nFront; i++) { if (pos[i * 3 + 2] <= 1e-6) { back[i] = i; continue; } back[i] = pos.length / 3; pos.push(pos[i * 3], pos[i * 3 + 1], o.flatBack ? 0 : -pos[i * 3 + 2]); cols.push(cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2]); }
    for (let w = 0; w < H - 1; w++) for (let u = 0; u < W - 1; u++) {
      const a = id[w * W + u], b = id[w * W + u + 1], c2 = id[(w + 1) * W + u], e = id[(w + 1) * W + u + 1];
      const face = (p1, p2, p3) => { if (p1 < 0 || p2 < 0 || p3 < 0) return; tri.push(p1, p3, p2, back[p1], back[p2], back[p3]); };
      face(a, b, e); face(a, e, c2);
    }
    onStep('Painting it with the photo…'); await new Promise((r) => setTimeout(r, 20));
    return { ply: toPLY(pos, cols, tri, { nx: 0, nz: 0, cell: 1 }), triangles: tri.length / 3 };
  }
  window.PHOTO3D = { build, build1 };
})();
