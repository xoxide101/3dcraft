/* 3DCraft modifiers (window.MODS), as in Blender: changes stacked on an object and worked out in order each time it is
   built, so they never change the object itself (turn one off, or take it away, and the object is as it was).
   Shape changers (twist, bend, taper, displace, smooth, decimate) work on the object's surface: before bending it they
   add enough points to bend smoothly; sharp edges stay sharp (normals creased at 35°) and each face keeps its material.
   Copiers (array, mirror) put copies of the result beside it. m.mods = [{ type, on, …settings }]. */
(function () {
  'use strict';
  const T = window.THREE, U = T.BufferGeometryUtils;
  // [name, settings, controls: [key, label, min, max, step] or [key, label, [[value, label]…]]]
  const AXES = [['x', 'X (across)'], ['y', 'Y (up)'], ['z', 'Z (front to back)']];
  const LIST = {
    array: ['Array (copies)', { count: 3, spread: 'line', axis: 'x', gap: 0.3, radius: 3 }, [['count', 'How many', 2, 40, 1], ['spread', 'Laid out', [['line', 'In a line'], ['circle', 'In a circle'], ['grid', 'In a grid']]], ['axis', 'Along', AXES], ['gap', 'Gap between', 0, 10, 0.05], ['radius', 'Circle size', 0.5, 30, 0.1]]],
    mirror: ['Mirror (copy flipped)', { axis: 'x', gap: 0 }, [['axis', 'Across', AXES], ['gap', 'Gap', 0, 5, 0.02]]],
    twist: ['Twist', { angle: 90, axis: 'y' }, [['angle', 'Twist (degrees)', -720, 720, 5], ['axis', 'Around', AXES]]],
    bend: ['Bend', { angle: 90, axis: 'x' }, [['angle', 'Bend (degrees)', -360, 360, 5], ['axis', 'Along', AXES]]],
    taper: ['Taper', { amount: 0.5, axis: 'y' }, [['amount', 'Narrower at the end', -1, 0.95, 0.05], ['axis', 'Along', AXES]]],
    displace: ['Displace (bumpy)', { amount: 0.12, size: 0.6, seed: 1 }, [['amount', 'Height of the bumps', -1, 1, 0.01], ['size', 'Size of the bumps', 0.05, 5, 0.05], ['seed', 'Pattern', 1, 99, 1]]],
    smooth: ['Smooth', { level: 2, keepEdges: false }, [['level', 'How smooth', 1, 4, 1]]],
    boolean: ['Boolean (cut, join, overlap)', { op: 'subtract', with: '' }, []],
    decimate: ['Decimate (fewer triangles)', { keep: 0.5 }, [['keep', 'Keep (of the triangles)', 0.02, 1, 0.01]]],
  };
  const SHAPERS = new Set(['twist', 'bend', 'taper', 'displace', 'smooth', 'decimate']);
  const A = { x: 0, y: 1, z: 2 };

  // ---------------------------------------------------------------- geometry helpers
  // every triangle into four (midpoints), keeping all attributes and the material groups
  function split4(g) {
    const pos = g.attributes.position, n = pos.count, names = Object.keys(g.attributes).filter((k) => k !== 'normal'), out = {};
    names.forEach((k) => { const a = g.attributes[k]; out[k] = { size: a.itemSize, data: new Float32Array(n * 4 * a.itemSize) }; });
    for (let t = 0; t < n / 3; t++) {
      const i = t * 3, corners = [i, i + 1, i + 2];
      names.forEach((k) => {
        const a = g.attributes[k], s = a.itemSize, d = out[k].data, get = (v) => Array.from({ length: s }, (_, c) => a.array[v * s + c]);
        const [p0, p1, p2] = corners.map(get), mid = (p, q) => p.map((x, c) => (x + q[c]) / 2), m01 = mid(p0, p1), m12 = mid(p1, p2), m20 = mid(p2, p0);
        [p0, m01, m20, m01, p1, m12, m20, m12, p2, m01, m12, m20].forEach((v, j) => d.set(v, (t * 12 + j) * s));
      });
    }
    const r = new T.BufferGeometry(); names.forEach((k) => r.setAttribute(k, new T.BufferAttribute(out[k].data, out[k].size)));
    (g.groups || []).forEach((gr) => r.addGroup(gr.start * 4, gr.count * 4, gr.materialIndex));
    return r;
  }
  // enough points to bend smoothly: split until there are about `want` triangles (never more than `max`)
  function refine(g, want = 6000, max = 160000) {
    let r = g.index ? g.toNonIndexed() : g.clone(); r.deleteAttribute && r.deleteAttribute('normal');
    let tris = r.attributes.position.count / 3;
    while (tris < want && tris * 4 <= max) { r = split4(r); tris *= 4; }
    return r;
  }
  const finish = (g) => { g.deleteAttribute('normal'); const c = U.toCreasedNormals ? U.toCreasedNormals(g, (35 * Math.PI) / 180) : (g.computeVertexNormals(), g); c.computeBoundingBox(); c.computeBoundingSphere(); return c; };
  // points that share a place (the corners of neighbouring triangles), so smoothing and bumps keep the surface closed
  function shared(pos) {
    const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`, map = new Map(), id = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { const k = key(i); if (!map.has(k)) map.set(k, map.size); id[i] = map.get(k); }
    return { id, count: map.size };
  }
  // smooth value noise in 3D (for Displace)
  const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function noise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
    let r = 0; for (let c = 0; c < 8; c++) { const a = c & 1, b = (c >> 1) & 1, d = (c >> 2) & 1; r += hash(xi + a, yi + b, zi + d, s) * (a ? u : 1 - u) * (b ? v : 1 - v) * (d ? w : 1 - w); }
    return r * 2 - 1;
  }

  // ---------------------------------------------------------------- shape changers, in the object's own space
  function shape(geos, mod, box) {
    const size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3()), ax = A[mod.axis] ?? 1;
    const len = Math.max(1e-6, size.getComponent(ax)), lo = box.min.getComponent(ax);
    const others = [0, 1, 2].filter((k) => k !== ax), P = new T.Vector3();
    return geos.map(({ g, mat, inv }) => {
      let geo = g;
      if (mod.type === 'decimate') {
        const keep = Math.max(0.02, Math.min(1, mod.keep ?? 0.5)); if (keep >= 0.999) return { g: geo, mat, inv };
        const merged = U.mergeVertices(geo.index ? geo : geo.clone(), 1e-5), cnt = merged.attributes.position.count;
        try { geo = new T.SimplifyModifier().modify(merged, Math.floor(cnt * (1 - keep))); } catch (e) { geo = merged; }
        return { g: finish(geo.index ? geo.toNonIndexed() : geo), mat, inv };
      }
      if (mod.type === 'smooth') {
        geo = refine(geo, 0, 160000); for (let l = 0; l < (mod.level || 2) && geo.attributes.position.count * 4 <= 480000; l++) geo = split4(geo);
        const pos = geo.attributes.position, { id, count } = shared(pos), sum = new Float32Array(count * 3), nb = new Float32Array(count), cur = new Float32Array(count * 3);
        for (let i = 0; i < pos.count; i++) { cur[id[i] * 3] = pos.getX(i); cur[id[i] * 3 + 1] = pos.getY(i); cur[id[i] * 3 + 2] = pos.getZ(i); }
        // Taubin smoothing: a step in (λ) then a smaller step back out (μ), so it rounds without shrinking
        for (let it = 0; it < 6 * (mod.level || 2); it++) for (const k of [0.5, -0.53]) {
          sum.fill(0); nb.fill(0);
          for (let t = 0; t < pos.count; t += 3) for (let e = 0; e < 3; e++) { const a = id[t + e], b = id[t + ((e + 1) % 3)]; for (let q = 0; q < 3; q++) { sum[a * 3 + q] += cur[b * 3 + q]; sum[b * 3 + q] += cur[a * 3 + q]; } nb[a]++; nb[b]++; }
          for (let v = 0; v < count; v++) if (nb[v]) for (let q = 0; q < 3; q++) cur[v * 3 + q] += k * (sum[v * 3 + q] / nb[v] - cur[v * 3 + q]);
        }
        for (let i = 0; i < pos.count; i++) pos.setXYZ(i, cur[id[i] * 3], cur[id[i] * 3 + 1], cur[id[i] * 3 + 2]);
        return { g: finish(geo), mat, inv };
      }
      geo = refine(geo);
      const pos = geo.attributes.position;
      if (mod.type === 'displace') {
        // each point pushed out along the surface's rounded direction (the average of the triangles round it, worked out
        // in the object's space) by smooth noise; points in the same place move together, so the surface stays closed
        const { id, count } = shared(pos), W = new Float32Array(pos.count * 3), dir = new Float32Array(count * 3), A3 = new T.Vector3(), B3 = new T.Vector3(), C3 = new T.Vector3();
        for (let i = 0; i < pos.count; i++) { P.fromBufferAttribute(pos, i).applyMatrix4(inv.world); W[i * 3] = P.x; W[i * 3 + 1] = P.y; W[i * 3 + 2] = P.z; }
        for (let t = 0; t < pos.count; t += 3) {
          A3.fromArray(W, t * 3); B3.fromArray(W, t * 3 + 3); C3.fromArray(W, t * 3 + 6); B3.sub(A3); C3.sub(A3); B3.cross(C3);
          for (let e = 0; e < 3; e++) { const v = id[t + e]; dir[v * 3] += B3.x; dir[v * 3 + 1] += B3.y; dir[v * 3 + 2] += B3.z; }
        }
        for (let v = 0; v < count; v++) { const l = Math.hypot(dir[v * 3], dir[v * 3 + 1], dir[v * 3 + 2]) || 1; dir[v * 3] /= l; dir[v * 3 + 1] /= l; dir[v * 3 + 2] /= l; }
        const sz = Math.max(0.05, mod.size || 0.6), amt = (mod.amount ?? 0.12) * Math.max(size.x, size.y, size.z) * 0.5, seed = mod.seed || 1;
        for (let i = 0; i < pos.count; i++) {
          P.fromArray(W, i * 3); const v = id[i];
          const nz = noise(P.x / sz, P.y / sz, P.z / sz, seed) * 0.7 + noise((P.x * 2.3) / sz, (P.y * 2.3) / sz, (P.z * 2.3) / sz, seed + 7) * 0.3;
          P.x += dir[v * 3] * nz * amt; P.y += dir[v * 3 + 1] * nz * amt; P.z += dir[v * 3 + 2] * nz * amt;
          P.applyMatrix4(inv.local); pos.setXYZ(i, P.x, P.y, P.z);
        }
        return { g: finish(geo), mat, inv };
      }
      for (let i = 0; i < pos.count; i++) {
        P.fromBufferAttribute(pos, i).applyMatrix4(inv.world);
        const t = (P.getComponent(ax) - lo) / len; // 0 at one end, 1 at the other
        if (mod.type === 'twist') {
          const a = ((mod.angle || 0) * Math.PI) / 180 * (t - 0.5), [i1, i2] = others, x = P.getComponent(i1) - c.getComponent(i1), y = P.getComponent(i2) - c.getComponent(i2);
          P.setComponent(i1, c.getComponent(i1) + x * Math.cos(a) - y * Math.sin(a)); P.setComponent(i2, c.getComponent(i2) + x * Math.sin(a) + y * Math.cos(a));
        } else if (mod.type === 'taper') {
          const k = 1 - (mod.amount ?? 0.5) * t; others.forEach((o) => P.setComponent(o, c.getComponent(o) + (P.getComponent(o) - c.getComponent(o)) * k));
        } else if (mod.type === 'bend') {
          // along the axis the object curls into an arc (upwards, or towards the front when bending along up)
          const ang = ((mod.angle || 0) * Math.PI) / 180; if (Math.abs(ang) < 1e-4) continue;
          const up = ax === 1 ? 2 : 1, R = len / ang, th = (t - 0.5) * ang, d = P.getComponent(up) - c.getComponent(up);
          P.setComponent(ax, c.getComponent(ax) + (R - d) * Math.sin(th));
          P.setComponent(up, c.getComponent(up) + R - (R - d) * Math.cos(th));
        }
        P.applyMatrix4(inv.local); pos.setXYZ(i, P.x, P.y, P.z);
      }
      return { g: finish(geo), mat, inv };
    });
  }

  // ---------------------------------------------------------------- the stack
  function apply(o, mods) {
    const list = (mods || []).filter((md) => md && md.on !== false && LIST[md.type] && md.type !== 'boolean'); // (booleans are worked out in scene.js, which can build the other object)
    if (!list.length) return o;
    let root = o;
    for (const md of list) {
      root.updateMatrixWorld(true);
      if (SHAPERS.has(md.type)) {
        // the meshes, with how to get from each one's own space into the object's space and back
        const meshes = []; root.traverse((x) => { if (x.isMesh && !x.userData.fur && !x.userData.mirrorView) meshes.push(x); });
        const rootInv = new T.Matrix4().copy(root.matrixWorld).invert();
        const items = meshes.map((x) => { const world = new T.Matrix4().multiplyMatrices(rootInv, x.matrixWorld); return { x, g: x.geometry, mat: x.material, inv: { world, local: world.clone().invert() } }; });
        const box = new T.Box3(); items.forEach((it) => { const b = it.g.clone(); b.applyMatrix4(it.inv.world); b.computeBoundingBox(); box.union(b.boundingBox); });
        shape(items, md, box).forEach((r, i) => { items[i].x.geometry = r.g; });
        continue;
      }
      // copiers: the object so far, with copies beside it
      const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), ax = A[md.axis] ?? 0, g = new T.Group();
      g.add(root);
      if (md.type === 'mirror') {
        const c = root.clone(), edge = box.max.getComponent(ax) + (md.gap || 0) / 2, s = new T.Vector3(1, 1, 1); s.setComponent(ax, -1);
        c.scale.multiply(s); const p = c.position.clone(); p.setComponent(ax, 2 * edge - p.getComponent(ax)); c.position.copy(p); g.add(c);
        // keep the pair centred where the object was
        const shift = -(edge - (box.min.getComponent(ax) + box.max.getComponent(ax)) / 2); g.children.forEach((k) => { k.position.setComponent(ax, k.position.getComponent(ax) + shift); });
      } else {
        const n = Math.max(2, Math.min(40, Math.round(md.count || 3)));
        if (md.spread === 'circle') {
          const R = md.radius || 3; root.position.x += R;
          for (let i = 1; i < n; i++) { const c = root.clone(), a = (i / n) * Math.PI * 2; const p = new T.Group(); p.rotation.y = a; p.add(c); g.add(p); }
          const p0 = new T.Group(); g.remove(root); p0.add(root); g.add(p0);
        } else if (md.spread === 'grid') {
          const step = [size.x + (md.gap || 0), size.z + (md.gap || 0)], k = Math.ceil(Math.sqrt(n));
          for (let i = 1; i < n; i++) { const c = root.clone(); c.position.x += (i % k) * step[0]; c.position.z += Math.floor(i / k) * step[1]; g.add(c); }
          g.children.forEach((c) => { c.position.x -= ((k - 1) * step[0]) / 2; c.position.z -= ((Math.ceil(n / k) - 1) * step[1]) / 2; });
        } else {
          const step = size.getComponent(ax) + (md.gap || 0);
          for (let i = 1; i < n; i++) { const c = root.clone(); c.position.setComponent(ax, c.position.getComponent(ax) + i * step); g.add(c); }
          g.children.forEach((c) => c.position.setComponent(ax, c.position.getComponent(ax) - ((n - 1) * step) / 2));
        }
      }
      root = g;
    }
    return root;
  }
  window.MODS = { LIST, apply };
})();
