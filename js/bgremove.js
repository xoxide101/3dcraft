/* 3DCraft background remover (window.BGREMOVE), shared by Picture to 3D, Photos to 3D and the photo cut-out.
   The background is flooded in from the picture's edges (or from a point you click), so only background that touches
   the outside goes: white eyes inside a white-background drawing stay. It follows small colour steps, so shadows,
   gradients and darker corners on a photo's backdrop go too, while the object's edge (a bigger step) stops it.
   remove(src, { mode: 'auto' | 'off', actions: [{ t: 'wand', u, v } | { t: 'erase' | 'keep', r (0–1 of the width), pts: [[u, v], …] }], tolerance: 5–160, max })
   Touch-ups, in order: magic wand clicks (remove the connected area of a similar colour), eraser and restore strokes.
   Magic wand: each click removes the area connected to it whose colour is close to the colour clicked.
   → Promise<{ url (PNG with the background see-through), canvas, colour, removed (0–1) }> */
(function () {
  'use strict';
  const load = (src) => new Promise((res, rej) => { if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) return res(src); const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = src; });

  // the background colour: the most common colour round the edges
  function edgeColour(D, W, H) {
    const bins = new Map(), add = (i) => { if (D[i + 3] < 128) return; const k = (D[i] >> 4) << 8 | (D[i + 1] >> 4) << 4 | (D[i + 2] >> 4); const b = bins.get(k) || [0, 0, 0, 0]; b[0] += D[i]; b[1] += D[i + 1]; b[2] += D[i + 2]; b[3]++; bins.set(k, b); };
    for (let x = 0; x < W; x++) { add(x * 4); add(((H - 1) * W + x) * 4); }
    for (let y = 0; y < H; y++) { add(y * W * 4); add((y * W + W - 1) * 4); }
    let best = null; bins.forEach((b) => { if (!best || b[3] > best[3]) best = b; });
    return best ? [best[0] / best[3], best[1] / best[3], best[2] / best[3]] : null;
  }

  async function remove(src, o = {}) {
    const img = await load(src), max = o.max || 1600;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(iw, ih));
    const W = Math.max(1, Math.round(iw * k)), H = Math.max(1, Math.round(ih * k));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const id = x.getImageData(0, 0, W, H), D = id.data;
    const orig = new Uint8ClampedArray(D);
    const actions = o.actions || [];
    const tol = o.tolerance ?? 40, step = Math.max(6, tol * 0.45);
    let bg = edgeColour(D, W, H) || [255, 255, 255];
    // flood from the edges (and the clicked point): a neighbour joins if it is close to the background colour, or only a
    // small step from the pixel it was reached from and still not far from the background (shadows and gradients)
    const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0;
    const dist = (i, r, g, b) => Math.hypot(D[i] - r, D[i + 1] - g, D[i + 2] - b);
    const tryAdd = (p, from) => {
      if (seen[p]) return; const i = p * 4;
      if (D[i + 3] < 128) { seen[p] = 1; q[qt++] = p; return; }
      const dBg = dist(i, bg[0], bg[1], bg[2]);
      if (dBg < tol || (from >= 0 && dist(i, D[from * 4], D[from * 4 + 1], D[from * 4 + 2]) < step && dBg < tol * 2.4)) { seen[p] = 1; q[qt++] = p; }
    };
    const spread = () => { while (qh < qt) { const p = q[qh++], px = p % W, py = (p / W) | 0; if (px > 0) tryAdd(p - 1, p); if (px < W - 1) tryAdd(p + 1, p); if (py > 0) tryAdd(p - W, p); if (py < H - 1) tryAdd(p + W, p); } };
    if (o.mode !== 'off') {
      for (let xx = 0; xx < W; xx++) { tryAdd(xx, -1); tryAdd((H - 1) * W + xx, -1); }
      for (let yy = 0; yy < H; yy++) { tryAdd(yy * W, -1); tryAdd(yy * W + W - 1, -1); }
      spread();
    }
    // magic wand clicks: the colour under each, spread to the connected area close to that colour
    for (const a of actions) if (a.t === 'wand') { const sx = Math.min(W - 1, Math.max(0, Math.round(a.u * W))), sy = Math.min(H - 1, Math.max(0, Math.round(a.v * H))), p = sy * W + sx; bg = [orig[p * 4], orig[p * 4 + 1], orig[p * 4 + 2]]; if (!seen[p]) { seen[p] = 1; q[qt++] = p; } spread(); }
    // see-through where flooded, with a one-pixel soft edge so cut-outs are not jagged
    let removed = 0;
    for (let p = 0; p < W * H; p++) if (seen[p]) { D[p * 4 + 3] = 0; removed++; }
    for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
      const p = yy * W + xx; if (seen[p]) continue;
      const n = seen[p - 1] + seen[p + 1] + seen[p - W] + seen[p + W]; if (n) D[p * 4 + 3] = Math.min(D[p * 4 + 3], 255 - n * 45);
    }
    // eraser and restore strokes, painted in order over the result
    const strokes = actions.filter((a) => a.t === 'erase' || a.t === 'keep');
    if (strokes.length) {
      const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const sx2 = sc.getContext('2d', { willReadFrequently: true });
      strokes.forEach((a) => {
        sx2.clearRect(0, 0, W, H); sx2.strokeStyle = sx2.fillStyle = '#fff'; sx2.lineWidth = Math.max(1, a.r * W * 2); sx2.lineCap = sx2.lineJoin = 'round';
        sx2.beginPath(); a.pts.forEach(([u, v], i) => (i ? sx2.lineTo(u * W, v * H) : sx2.moveTo(u * W, v * H))); if (a.pts.length === 1) { sx2.arc(a.pts[0][0] * W, a.pts[0][1] * H, a.r * W, 0, Math.PI * 2); sx2.fill(); } else sx2.stroke();
        const m = sx2.getImageData(0, 0, W, H).data;
        for (let p = 0; p < W * H; p++) { const k2 = m[p * 4 + 3] / 255; if (!k2) continue; D[p * 4 + 3] = a.t === 'erase' ? Math.round(D[p * 4 + 3] * (1 - k2)) : Math.round(D[p * 4 + 3] + (orig[p * 4 + 3] - D[p * 4 + 3]) * k2); }
      });
    }
    x.putImageData(id, 0, 0);
    return { url: c.toDataURL('image/png'), canvas: c, colour: bg, removed: removed / (W * H) };
  }
  window.BGREMOVE = { remove };
})();
