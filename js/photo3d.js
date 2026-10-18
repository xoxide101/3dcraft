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
  function carve(views, res, dir, axisAt) {
    const N = views.length, step = (Math.PI * 2) / N * (dir === 'cw' ? -1 : 1);
    // a common axis (the turntable's middle) and scale: all photos come from the same still camera
    const axis = axisAt ?? views.reduce((s, v) => s + (v.x0 + v.x1) / 2, 0) / N, top = Math.min(...views.map((v) => v.y0)), bot = Math.max(...views.map((v) => v.y1));
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

  // Checking the result against what was expected: how well the carved shape seen from each photo's side covers that
  // photo's outline (1 = exactly), and how round it is across (each row's filled cells against the ellipse round them;
  // 1 = round, about 0.64 for a diamond, 1.27 for a square)
  function check(c, views) {
    const { grid, nx, ny, nz, cell, axis, bot, cos, sin } = c, id = (i, j, k) => (k * ny + j) * nx + i, r = Math.max(1, Math.ceil(cell / 2));
    const match = views.map((v, q) => {
      const seen = new Uint8Array(v.W * v.H);
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        if (!grid[id(i, j, k)]) continue; const X = (i - nx / 2 + 0.5) * cell, Z = (k - nz / 2 + 0.5) * cell, px = Math.round(axis + X * cos[q] + Z * sin[q]), py = Math.round(bot + 2 - (j + 0.5) * cell);
        for (let dy = -r; dy < r; dy++) for (let dx = -r; dx < r; dx++) { const x = px + dx, y = py + dy; if (x >= 0 && y >= 0 && x < v.W && y < v.H) seen[y * v.W + x] = 1; }
      }
      let both = 0, either = 0; for (let i = 0; i < seen.length; i++) { if (seen[i] && v.mask[i]) both++; if (seen[i] || v.mask[i]) either++; }
      return either ? both / either : 0;
    });
    let sum = 0, n = 0;
    for (let j = 1; j < ny - 1; j++) {
      let cnt = 0, i0 = nx, i1 = -1, k0 = nz, k1 = -1;
      for (let k = 1; k < nz - 1; k++) for (let i = 1; i < nx - 1; i++) if (grid[id(i, j, k)]) { cnt++; if (i < i0) i0 = i; if (i > i1) i1 = i; if (k < k0) k0 = k; if (k > k1) k1 = k; }
      if (cnt < 12) continue; const ell = Math.PI * ((i1 - i0 + 1) / 2) * ((k1 - k0 + 1) / 2); sum += cnt / ell; n++;
    }
    return { match, roundness: n ? sum / n : 1 };
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
  function colour(c, views, pos, tri, only) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(tri); g.computeVertexNormals();
    const nrm = g.attributes.normal, N = views.length, cols = new Uint8Array(pos.length);
    for (let p = 0; p < pos.length / 3; p++) {
      const X = (pos[p * 3] - c.nx / 2) * c.cell, Y = pos[p * 3 + 1], Z = (pos[p * 3 + 2] - c.nz / 2) * c.cell, nX = nrm.getX(p), nZ = nrm.getZ(p);
      // view q's sideways axis is (cos, 0, sin), so its camera sits towards (-sin, 0, cos): pick the view facing the point most
      let best = 0, bestDot = -2;
      for (let q = 0; q < N; q++) { if (only && !only.includes(q)) continue; const d = nZ * c.cos[q] - nX * c.sin[q]; if (d > bestDot) { bestDot = d; best = q; } }
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
    const c = carve(views, o.detail || 96, o.dir, o.axis);
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
    const cols = colour(c, views, pos, tri, o.paintFrom);
    return { ply: toPLY(pos, cols, tri, c), triangles: tri.length / 3, check: check(c, views) };
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
  // Round things from one side picture (cups, vases, bottles, glasses, chess pieces): the outline's half width on each
  // row, measured from the centre line, is the profile; it is spun all the way round (a lathe) into a closed body. The
  // picture is wrapped round the front (each point takes the colour straight in front of it), and the back takes each
  // row's main colour (so a face on the front is not repeated). Whatever sticks out further on one side (a handle, a
  // spout) is cut from the picture and rounded into a solid of its own. o = { detail (rows), hollow, wall (0–0.5 of the
  // widest radius), segments }
  async function buildRound(photo, o = {}, onStep = () => {}) {
    onStep('Cutting out the picture…'); await new Promise((r) => setTimeout(r, 20));
    const v = await silhouetteOf(photo, o.detail ? o.detail * 2.5 : 420, o);
    if (v.n < 50) throw new Error('Nothing stood out from the background: use a picture on a plain background, or change the tolerance.');
    onStep('Finding the shape round its middle…'); await new Promise((r) => setTimeout(r, 20));
    const { W, H, mask, rgb } = v, L = new Int32Array(H).fill(-1), R = new Int32Array(H).fill(-1);
    for (let y = v.y0; y <= v.y1; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (L[y] < 0) L[y] = x; R[y] = x; }
    const mids = []; for (let y = v.y0; y <= v.y1; y++) if (L[y] >= 0) mids.push((L[y] + R[y]) / 2);
    // the centre line: the most common row middle (rows with a handle have their middle pulled to one side, and can
    // even be most of the rows, so the median would follow them; plain rows all share the true middle)
    let cx = o.axis;
    if (cx == null) { const hist = new Map(); mids.forEach((m) => { const k = Math.round(m); hist.set(k, (hist.get(k) || 0) + 1); }); let bestN = -1; hist.forEach((n, k) => { const n3 = n + (hist.get(k - 1) || 0) * 0.5 + (hist.get(k + 1) || 0) * 0.5; if (n3 > bestN) { bestN = n3; cx = k; } }); }
    // the radius on each row: the nearer side (a handle only sticks out on one side), lightly smoothed
    const r0 = new Float32Array(H), rad = new Float32Array(H);
    for (let y = v.y0; y <= v.y1; y++) if (L[y] >= 0) r0[y] = Math.max(0, Math.min(cx - L[y], R[y] - cx) + 0.5);
    for (let y = v.y0; y <= v.y1; y++) { let s = 0, n = 0; for (let d = -2; d <= 2; d++) { const q = y + d; if (q >= v.y0 && q <= v.y1 && r0[q] > 0) { s += r0[q]; n++; } } rad[y] = n ? s / n : 0; }
    let maxR = 0; for (let y = v.y0; y <= v.y1; y++) maxR = Math.max(maxR, rad[y]);
    const at = (x, y) => (Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))) * 4;
    // each row's main colour (for the back), from the inside of the row
    const rowCol = []; for (let y = 0; y < H; y++) {
      const bins = new Map(); let best = null;
      if (rad[y] > 0) for (let x = Math.ceil(cx - rad[y] * 0.9); x <= cx + rad[y] * 0.9; x++) { const i = at(x, y), dark = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2] < 55, k = (dark ? 1 << 15 : 0) | (rgb[i] >> 5) << 6 | (rgb[i + 1] >> 5) << 3 | (rgb[i + 2] >> 5); const b = bins.get(k) || [0, 0, 0, 0, dark]; b[0] += rgb[i]; b[1] += rgb[i + 1]; b[2] += rgb[i + 2]; b[3]++; bins.set(k, b); }
      bins.forEach((b) => { if (!best || (best[4] && !b[4]) || (b[4] === best[4] && b[3] > best[3])) best = b; });
      rowCol.push(best ? [best[0] / best[3], best[1] / best[3], best[2] / best[3]] : [200, 200, 200]);
    }
    onStep('Spinning it round…'); await new Promise((r) => setTimeout(r, 20));
    const S = o.segments || 192, rows = []; for (let y = v.y0; y <= v.y1; y++) if (rad[y] > 0.5) rows.push(y);
    const pos = [], cols = [], tri = [];
    const add = (x, y, z, c) => { pos.push(x, y, z); cols.push(c[0], c[1], c[2]); return pos.length / 3 - 1; };
    const ring = (y, r, colour) => { const first = pos.length / 3; for (let k = 0; k < S; k++) { const t = (k / S) * Math.PI * 2, sx = Math.sin(t), cz = Math.cos(t); add(r * sx, H - y, r * cz, colour(t, sx, cz)); } return first; };
    const front = (y, r) => (t, sx, cz) => {
      if (cz <= 0) return rowCol[y];
      const i = at(cx + r * 0.93 * sx, y), f = Math.min(1, cz / 0.35), b = rowCol[y];
      return [rgb[i] * f + b[0] * (1 - f), rgb[i + 1] * f + b[1] * (1 - f), rgb[i + 2] * f + b[2] * (1 - f)];
    };
    const join = (a, b, flip) => { for (let k = 0; k < S; k++) { const k2 = (k + 1) % S; if (flip) tri.push(a + k, a + k2, b + k, a + k2, b + k2, b + k); else tri.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); } };
    // a flat end: its own copy of the edge points, so its shading stays flat and does not bleed into the sides
    const cap = (ringStart0, y, colour, up) => { const ringStart = pos.length / 3; for (let k = 0; k < S; k++) add(pos[(ringStart0 + k) * 3], pos[(ringStart0 + k) * 3 + 1], pos[(ringStart0 + k) * 3 + 2], colour); const c = add(0, H - y, 0, colour); for (let k = 0; k < S; k++) { const k2 = (k + 1) % S; if (up) tri.push(c, ringStart + k, ringStart + k2); else tri.push(c, ringStart + k2, ringStart + k); } };
    const outer = rows.map((y) => ring(y, rad[y], front(y, rad[y])));
    for (let i = 0; i + 1 < outer.length; i++) join(outer[i], outer[i + 1], false);
    const top = rows[0], bottom = rows[rows.length - 1];
    const inside = (frac) => rowCol[rows[Math.max(0, Math.min(rows.length - 1, Math.round(rows.length * frac)))]];
    cap(outer[outer.length - 1], bottom, inside(0.96), false);
    if (o.hollow) {
      // a wall all round and a base; the top is open with a rim joining the outside to the inside
      const wall = Math.max(1, maxR * (o.wall ?? 0.08)), base = Math.max(2, Math.round(wall * 1.5)), inRows = rows.filter((y) => y <= bottom - base);
      const shade = (c) => [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
      const inner = inRows.map((y) => ring(y, Math.max(0.5, rad[y] - wall), () => shade(rowCol[y])));
      for (let i = 0; i + 1 < inner.length; i++) join(inner[i], inner[i + 1], true);
      join(outer[0], inner[0], true);
      cap(inner[inner.length - 1], inRows[inRows.length - 1], shade(rowCol[bottom]), true);
    } else cap(outer[0], top, inside(0.04), true);
    // a handle or spout: the part of the outline outside the round body, rounded like a cushion
    const hm = new Uint8Array(W * H); let hn = 0;
    for (let y = v.y0; y <= v.y1; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] && Math.abs(x - cx) > rad[y] + 2) { hm[y * W + x] = 1; hn++; }
    if (hn > Math.max(30, v.n * 0.01)) {
      onStep('Shaping the handle…'); await new Promise((r) => setTimeout(r, 20));
      const d = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) d[i] = hm[i] ? 1e9 : 0;
      for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) { const q = y * W + x; if (d[q]) d[q] = Math.min(d[q], d[q - 1] + 3, d[q - W] + 3, d[q - W - 1] + 4, d[q - W + 1] + 4); }
      for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) { const q = y * W + x; if (d[q]) d[q] = Math.min(d[q], d[q + 1] + 3, d[q + W] + 3, d[q + W + 1] + 4, d[q + W - 1] + 4); }
      let maxD = 0; for (let i = 0; i < d.length; i++) { d[i] /= 3; if (d[i] > maxD) maxD = d[i]; }
      // the handle reaches into the body a little so the two join
      const idx = new Int32Array(W * H).fill(-1), thick = Math.min(maxR * 0.35, maxD * 2), hh = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * W + x; if (!hm[q]) continue; const t = Math.min(1, d[q] / Math.max(1, maxD)); hh[q] = thick * Math.sqrt(1 - (1 - t) * (1 - t)); }
      const sideX = (x, y) => { const dx = x - cx, inR = rad[y] * 0.85; return Math.abs(dx) > rad[y] + 2 ? dx : Math.sign(dx) * inR; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * W + x; if (!hm[q]) continue; const i = at(x, y); idx[q] = add(sideX(x, y), H - y, hh[q], [rgb[i], rgb[i + 1], rgb[i + 2]]); }
      const n0 = pos.length / 3, back = new Int32Array(W * H).fill(-1);
      for (let q = 0; q < W * H; q++) { if (idx[q] < 0) continue; if (hh[q] <= 1e-6) { back[q] = idx[q]; continue; } const p = idx[q]; back[q] = add(pos[p * 3], pos[p * 3 + 1], -hh[q], [cols[p * 3], cols[p * 3 + 1], cols[p * 3 + 2]]); }
      void n0;
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
        const a = y * W + x, b = a + 1, c2 = a + W, e = a + W + 1;
        const face = (p1, p2, p3) => { if (idx[p1] < 0 || idx[p2] < 0 || idx[p3] < 0) return; tri.push(idx[p1], idx[p3], idx[p2], back[p1], back[p2], back[p3]); };
        face(a, b, e); face(a, e, c2);
      }
    }
    onStep('Painting it…'); await new Promise((r) => setTimeout(r, 20));
    return { ply: toPLY(pos, cols, tri, { nx: 0, nz: 0, cell: 1 }), triangles: tri.length / 3 };
  }
  // Puffy, for clip art, icons, emoji and dingbats: the picture's colours are grouped into its few flat colours, each
  // colour area is found, the whole outline is rounded like a cushion, and every smaller area (eyes, stripes, outlines,
  // spots) gets a rounded bump of its own on top, sized to that area. The back is a plain rounded mirror of the body
  // (details only on the front), or flat for a printer's bed. Each area keeps its clean colour.
  // o = { detail (cells across, default 220), puff (thickness), raise (0–1.5: how far details stand out), colours (most
  // colours kept, default 8), flatBack, tolerance / bg (background removal) }
  async function buildPuffy(photo, o = {}, onStep = () => {}) {
    onStep('Cutting out the picture…'); await new Promise((r) => setTimeout(r, 20));
    const res = o.detail || 220, v = await silhouetteOf(photo, res, o);
    if (v.n < 50) throw new Error('Nothing stood out from the background: use a picture on a plain background, or change the tolerance.');
    const W = v.x1 - v.x0 + 3, H = v.y1 - v.y0 + 3, N = W * H;
    const src = (u, w) => (((w + v.y0 - 1) * v.W) + (u + v.x0 - 1)) * 4;
    const inside = new Uint8Array(N);
    for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) { const x = u + v.x0 - 1, y = w + v.y0 - 1; if (x >= 0 && y >= 0 && x < v.W && y < v.H && v.mask[y * v.W + x]) inside[w * W + u] = 1; }
    onStep('Finding its colours…'); await new Promise((r) => setTimeout(r, 20));
    // k-means on the colours inside (started from colours far apart), then colours closer than 38 are merged
    const px = []; for (let q = 0; q < N; q++) if (inside[q]) { const i = src(q % W, (q / W) | 0); px.push(q, v.rgb[i], v.rgb[i + 1], v.rgb[i + 2]); }
    const n = px.length / 4, K = Math.max(2, Math.min(12, o.colours || 8)), dist2 = (a, r, g, b) => (a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2;
    let cent = [[px[1], px[2], px[3]]];
    while (cent.length < K) { let best = -1, bi = 0; for (let t = 0; t < n; t += 7) { const r = px[t * 4 + 1], g = px[t * 4 + 2], b = px[t * 4 + 3]; const d = Math.min(...cent.map((c) => dist2(c, r, g, b))); if (d > best) { best = d; bi = t; } } if (best < 30 * 30) break; cent.push([px[bi * 4 + 1], px[bi * 4 + 2], px[bi * 4 + 3]]); }
    const lab = new Int16Array(N).fill(-1);
    for (let it = 0; it < 8; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      for (let t = 0; t < n; t++) { const r = px[t * 4 + 1], g = px[t * 4 + 2], b = px[t * 4 + 3]; let bk = 0, bd = Infinity; cent.forEach((c, k) => { const d = dist2(c, r, g, b); if (d < bd) { bd = d; bk = k; } }); lab[px[t * 4]] = bk; const s = sum[bk]; s[0] += r; s[1] += g; s[2] += b; s[3]++; }
      cent = cent.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
    }
    for (let a = 0; a < cent.length; a++) for (let b = a + 1; b < cent.length; b++) if (dist2(cent[a], ...cent[b]) < 38 * 38) { for (let q = 0; q < N; q++) if (lab[q] === b) lab[q] = a; }
    // anti-aliased edges between colours leave specks: two passes of "take the colour most of the neighbours have"
    for (let pass = 0; pass < 2; pass++) {
      const nl = lab.slice();
      for (let w = 1; w < H - 1; w++) for (let u = 1; u < W - 1; u++) { const q = w * W + u; if (!inside[q]) continue; const cnt = new Map(); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const l = lab[q + j * W + i]; if (l >= 0) cnt.set(l, (cnt.get(l) || 0) + 1); } let bl = lab[q], bc = 0; cnt.forEach((c, l) => { if (c > bc) { bc = c; bl = l; } }); nl[q] = bl; }
      lab.set(nl);
    }
    onStep('Puffing it up…'); await new Promise((r) => setTimeout(r, 20));
    // distance to the outline (for the body) and to the edge of each colour area (for its bump)
    const chamfer = (isEdge) => {
      const d = new Float32Array(N); for (let q = 0; q < N; q++) d[q] = inside[q] ? 1e9 : 0;
      for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) { const q = w * W + u; if (!d[q]) continue; if (u === 0 || w === 0 || isEdge(q, q - 1) || isEdge(q, q - W)) { d[q] = 3; continue; } d[q] = Math.min(d[q], d[q - 1] + 3, d[q - W] + 3, d[q - W - 1] + 4, (u < W - 1 ? d[q - W + 1] : 1e9) + 4); }
      for (let w = H - 1; w >= 0; w--) for (let u = W - 1; u >= 0; u--) { const q = w * W + u; if (!d[q]) continue; if (u === W - 1 || w === H - 1 || isEdge(q, q + 1) || isEdge(q, q + W)) { d[q] = Math.min(d[q], 3); continue; } d[q] = Math.min(d[q], d[q + 1] + 3, d[q + W] + 3, d[q + W + 1] + 4, (u > 0 ? d[q + W - 1] : 1e9) + 4); }
      for (let q = 0; q < N; q++) d[q] /= 3; return d;
    };
    const d0 = chamfer((q, r) => !inside[r]), dR = chamfer((q, r) => !inside[r] || lab[r] !== lab[q]);
    let maxD0 = 1; for (let q = 0; q < N; q++) if (d0[q] > maxD0) maxD0 = d0[q];
    // each connected colour area: its own deepest point sets its bump's height; the biggest area is the body (no bump)
    const reg = new Int32Array(N).fill(-1), regMax = [], regSize = []; let nr = 0;
    for (let q0 = 0; q0 < N; q0++) {
      if (!inside[q0] || reg[q0] >= 0) continue; const stack = [q0]; reg[q0] = nr; let mx = 0, sz = 0;
      while (stack.length) { const q = stack.pop(); sz++; if (dR[q] > mx) mx = dR[q]; const u = q % W; for (const r of [u > 0 ? q - 1 : -1, u < W - 1 ? q + 1 : -1, q - W, q + W]) if (r >= 0 && r < N && inside[r] && reg[r] < 0 && lab[r] === lab[q]) { reg[r] = nr; stack.push(r); } }
      regMax.push(mx); regSize.push(sz); nr++;
    }
    let body = 0; regSize.forEach((s, i) => { if (s > regSize[body]) body = i; });
    const puff = o.puff ?? 1, raise = o.raise ?? 0.5, top = maxD0 * 0.5 * puff, band = Math.max(1.5, maxD0);
    const round = (x) => Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x)));
    const hf = new Float32Array(N), hb = new Float32Array(N);
    for (let q = 0; q < N; q++) {
      if (!inside[q]) continue;
      const base = top * round(Math.min(1, Math.max(0, d0[q] - 1) / band));
      const R = reg[q], bump = R === body ? 0 : raise * Math.min(regMax[R], maxD0 * 0.35) * round(Math.min(1, Math.max(0, dR[q] - 0.5) / Math.max(1, regMax[R])));
      hf[q] = base + bump; hb[q] = o.flatBack ? 0 : base;
    }
    onStep('Building it…'); await new Promise((r) => setTimeout(r, 20));
    const colOf = (q) => { const c = lab[q] >= 0 ? cent[lab[q]] : [200, 200, 200]; return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]; };
    const id = new Int32Array(N).fill(-1), back = new Int32Array(N).fill(-1), pos = [], cols = [], tri = [];
    for (let w = 0; w < H; w++) for (let u = 0; u < W; u++) { const q = w * W + u; if (!inside[q]) continue; id[q] = pos.length / 3; pos.push(u - W / 2, H - w, hf[q]); cols.push(...colOf(q)); }
    // the back: its own points, except where both sides are at the outline (height 0): there they share, so it is closed
    for (let q = 0; q < N; q++) { if (id[q] < 0) continue; if (hf[q] <= 1e-6 && (o.flatBack || hb[q] <= 1e-6)) { back[q] = id[q]; continue; } back[q] = pos.length / 3; const p = id[q]; pos.push(pos[p * 3], pos[p * 3 + 1], -hb[q]); cols.push(...colOf(q)); }
    for (let w = 0; w < H - 1; w++) for (let u = 0; u < W - 1; u++) {
      const a = w * W + u, b = a + 1, c2 = a + W, e = a + W + 1;
      const face = (p1, p2, p3) => { if (id[p1] < 0 || id[p2] < 0 || id[p3] < 0) return; tri.push(id[p1], id[p3], id[p2], back[p1], back[p2], back[p3]); };
      face(a, b, e); face(a, e, c2);
    }
    return { ply: toPLY(pos, cols, tri, { nx: 0, nz: 0, cell: 1 }), triangles: tri.length / 3, colours: new Set(lab).size - (lab.includes(-1) ? 1 : 0), areas: nr };
  }
  // Four views from one picture: the picture is the front; the back, left and right are worked out from it (filled in),
  // then all four are carved like turntable photos taken a quarter turn apart. Any view can be replaced by a real one:
  // the more you give it, the closer the result.
  //  - thickness at each point: AI depth when it is on (near parts thicker), eased to nothing at the outline, up to
  //    `thick` × the width; the back reaches 85 % as far as the front
  //  - back: the front mirrored, the same picture on both sides (o.back 'same'), or softened (blurred, o.back 'soft') so
  //    a face or details on the front are not repeated
  //  - sides: for each row, the nearest part of the object to that side, in its own colours
  // All views share one size and one centre line (axis), so they line up when carved.
  const rowColours = (D, W, H, inside) => {
    const out = [];
    for (let y = 0; y < H; y++) {
      const bins = new Map(); let best = null;
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (!inside(x, y)) continue; const dark = 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2] < 55, k = (dark ? 1 << 15 : 0) | (D[i] >> 5) << 6 | (D[i + 1] >> 5) << 3 | (D[i + 2] >> 5); const b = bins.get(k) || [0, 0, 0, 0, dark]; b[0] += D[i]; b[1] += D[i + 1]; b[2] += D[i + 2]; b[3]++; bins.set(k, b); }
      bins.forEach((b) => { if (!best || (best[4] && !b[4]) || (b[4] === best[4] && b[3] > best[3])) best = b; });
      out.push(best ? [best[0] / best[3], best[1] / best[3], best[2] / best[3]] : null);
    }
    // rows with nothing take the nearest row's colour
    for (let y = 0; y < H; y++) if (!out[y]) { for (let d = 1; d < H; d++) { const c = out[y - d] || out[y + d]; if (c) { out[y] = c; break; } } if (!out[y]) out[y] = [180, 180, 180]; }
    return out;
  };
  // o.kind: what the object is expected to be ('round' | 'figure' | 'box' | …, from What is it?); round things get
  // sides with the same outline as the front, and are carved from 16 angles so they come out round
  async function views4(photo, o = {}, onStep = () => {}) {
    onStep('Cutting out the picture…'); await new Promise((r) => setTimeout(r, 20));
    const cut = await BGREMOVE.remove(photo, { ...(o.bg || { mode: 'auto', tolerance: o.tolerance ?? 40 }), max: 1200 });
    const src = cut.canvas, sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, x1 = -1, y0 = src.height, y1 = -1;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (sd[(y * src.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error('Nothing stood out from the background: use a picture on a plain background, or change the tolerance.');
    const k = Math.min(380 / (y1 - y0 + 1), 300 / (x1 - x0 + 1)), fw = Math.max(4, Math.round((x1 - x0 + 1) * k)), fh = Math.max(4, Math.round((y1 - y0 + 1) * k));
    const F = document.createElement('canvas'); F.width = fw; F.height = fh; F.getContext('2d').drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, fw, fh);
    const D = F.getContext('2d').getImageData(0, 0, fw, fh).data, inside = (x, y) => D[(y * fw + x) * 4 + 3] > 128;
    // distance to the outline (city-block, two passes), for easing the thickness off at the edge
    const dist = new Float32Array(fw * fh);
    for (let i = 0; i < fw * fh; i++) dist[i] = D[i * 4 + 3] > 128 ? 1e9 : 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const q = y * fw + x; if (!dist[q]) continue; let m = dist[q]; if (x > 0) m = Math.min(m, dist[q - 1] + 1); if (y > 0) m = Math.min(m, dist[q - fw] + 1); if (x === 0 || y === 0) m = 1; dist[q] = m; }
    for (let y = fh - 1; y >= 0; y--) for (let x = fw - 1; x >= 0; x--) { const q = y * fw + x; if (!dist[q]) continue; let m = dist[q]; if (x < fw - 1) m = Math.min(m, dist[q + 1] + 1); if (y < fh - 1) m = Math.min(m, dist[q + fw] + 1); if (x === fw - 1 || y === fh - 1) m = 1; dist[q] = m; }
    let maxD = 1; for (let i = 0; i < dist.length; i++) if (dist[i] > maxD) maxD = dist[i];
    let near = null;
    if (o.kind !== 'round' && o.depth !== false && window.CRAFTAI && CRAFTAI.enabled('depth')) {
      onStep('Working out the depth (AI)…');
      const dm = await CRAFTAI.depth(F.toDataURL('image/png')); near = new Float32Array(fw * fh); let lo = Infinity, hi = -Infinity;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { if (!inside(x, y)) continue; const z = dm.d[Math.min(dm.H - 1, Math.floor(((y + 0.5) * dm.H) / fh)) * dm.W + Math.min(dm.W - 1, Math.floor(((x + 0.5) * dm.W) / fw))]; near[y * fw + x] = z; if (z < lo) lo = z; if (z > hi) hi = z; }
      const kk = 1 / Math.max(1e-6, hi - lo); for (let i = 0; i < near.length; i++) near[i] = (near[i] - lo) * kk;
    }
    onStep('Filling in the other sides…'); await new Promise((r) => setTimeout(r, 20));
    const T = fw * (o.thick ?? 0.3), t = new Float32Array(fw * fh); let Z = o.kind === 'round' ? fw / 2 : 1;
    for (let q = 0; q < fw * fh; q++) { if (D[q * 4 + 3] <= 128) continue; t[q] = T * (near ? 0.3 + 0.7 * near[q] : 1) * Math.sqrt(Math.min(1, dist[q] / Math.max(2, maxD * 0.3))); Z = Math.max(Z, t[q]); }
    const Wc = Math.max(fw, Math.ceil(Z * 2)) + 10, Hc = fh + 10, A = Wc / 2, ox = Math.round(A - fw / 2), oy = 5;
    const back = rowColours(D, fw, fh, inside);
    // the softened picture: colours and texture without the details
    const Bc = document.createElement('canvas'); Bc.width = fw; Bc.height = fh; const bx0 = Bc.getContext('2d'); bx0.filter = `blur(${Math.max(3, Math.round(fw * 0.04))}px)`; bx0.drawImage(F, 0, 0);
    const BD = o.back === 'soft' ? bx0.getImageData(0, 0, fw, fh).data : D, soft = (x, y) => { const i = (y * fw + x) * 4; return BD[i + 3] > 20 ? [BD[i], BD[i + 1], BD[i + 2]] : back[y]; };
    const sheet = () => { const c = document.createElement('canvas'); c.width = Wc; c.height = Hc; const x = c.getContext('2d'); return [c, x, x.createImageData(Wc, Hc)]; };
    const put = (img, px, py, col) => { if (px < 0 || px >= Wc) return; const i = ((py + oy) * Wc + px) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; };
    // front: the picture itself
    const [fc, fx] = sheet(); fx.drawImage(F, ox, oy);
    // back: mirrored outline in each row's main colour, a little darker
    const [bc, bx, bi] = sheet();
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (inside(x, y)) { const c = soft(x, y), dim = o.back === 'soft' ? 0.92 : 1; put(bi, Math.round(2 * A - (ox + x) - 1), y, [c[0] * dim, c[1] * dim, c[2] * dim]); }
    bx.putImageData(bi, 0, 0);
    // sides: for each row, the part of the object nearest that side wins each spot
    const side = (fromLeft) => {
      const [c, x, img] = sheet(), done = new Uint8Array(Wc * Hc);
      for (let y = 0; y < fh; y++) for (let s = 0; s < fw; s++) {
        const xx = fromLeft ? s : fw - 1 - s, q = y * fw + xx; if (!t[q]) continue;
        const inw = Math.max(2, Math.round(fw * 0.03)), xi = Math.max(0, Math.min(fw - 1, xx + (fromLeft ? inw : -inw))), qi = inside(xi, y) ? y * fw + xi : q;
        const zf = Math.round(t[q]), zb = Math.round(t[q] * 0.85), i = qi * 4;
        for (let z = -zb; z <= zf; z++) {
          const px = Math.round(fromLeft ? A + z : A - z), o2 = (y + oy) * Wc + px; if (px < 0 || px >= Wc || done[o2]) continue; done[o2] = 1;
          const shade = 0.8 + 0.2 * (1 - Math.abs(z) / Math.max(1, t[q])), sc = soft(xi, y), col = z >= 0 ? [D[i] * shade, D[i + 1] * shade, D[i + 2] * shade] : [sc[0] * 0.88, sc[1] * 0.88, sc[2] * 0.88];
          put(img, px, y, col);
        }
      }
      x.putImageData(img, 0, 0); return c;
    };
    // a round thing looks the same from every side: its sides are the front's outline in each band's own colour (so a
    // face on the front is not repeated all the way round)
    const turn = () => { const [c, x, img] = sheet(); for (let y = 0; y < fh; y++) for (let xx = 0; xx < fw; xx++) if (inside(xx, y)) put(img, ox + xx, y, back[y]); x.putImageData(img, 0, 0); return c; };
    if (o.kind === 'round') return { front: fc, left: turn(), back: bc, right: turn(), axis: A, width: Wc, height: Hc, frontW: fw, frontH: fh, kind: 'round' };
    return { front: fc, left: side(true), back: bc, right: side(false), axis: A, width: Wc, height: Hc, frontW: fw, frontH: fh, kind: o.kind || '' };
  }
  // A view of your own (a photo or drawing of that side): cut out, then scaled to the front's height and centred on the
  // same line, so it lines up with the others
  async function fitView(src, info, o = {}) {
    const cut = await BGREMOVE.remove(src, { ...(o.bg || { mode: 'auto', tolerance: o.tolerance ?? 40 }), max: 1200 });
    const c0 = cut.canvas, d = c0.getContext('2d').getImageData(0, 0, c0.width, c0.height).data;
    let x0 = c0.width, x1 = -1, y0 = c0.height, y1 = -1;
    for (let y = 0; y < c0.height; y++) for (let x = 0; x < c0.width; x++) if (d[(y * c0.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error('Nothing stood out from the background in that picture.');
    const k = info.frontH / (y1 - y0 + 1), w = Math.min(info.width - 2, Math.round((x1 - x0 + 1) * k));
    const c = document.createElement('canvas'); c.width = info.width; c.height = info.height;
    c.getContext('2d').drawImage(c0, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round(info.axis - w / 2), 5, w, info.frontH);
    return c;
  }
  // build from the four views (front, left, back, right), a quarter turn apart
  function buildViews(v, o = {}, onStep = () => {}) {
    let photos = [v.front, v.left, v.back, v.right].map((c) => c.toDataURL('image/png'));
    // round: 16 views, the in-between ones the side outline, so the shape comes out round instead of square across
    const round = v.kind === 'round';
    if (round) photos = Array.from({ length: 16 }, (_, q) => (q % 4 === 0 ? photos[q / 4] : photos[1]));
    return build(photos, { ...o, paintFrom: round ? [0, 4, 8, 12] : null, bg: { mode: 'off', actions: [] }, dir: 'ccw', axis: v.axis, detail: o.detail || 128, smooth: o.smooth ?? 2 }, onStep);
  }
  window.PHOTO3D = { build, build1, buildRound, buildPuffy, views4, fitView, buildViews };
})();
