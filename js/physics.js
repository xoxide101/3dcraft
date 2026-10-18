/* 3DCraft physics (window.PHYS): objects that fall, bounce and knock each other about, worked out ahead of time
   (cannon-es) and turned into ordinary keyframes on the timeline, so the result plays, scrubs, renders and exports like
   any other animation. Collisions are noticed, like the player-missile collisions of the old Atari: an object can just
   bounce, vanish or pop when it hits something, and every hit is listed.
   m.phys = { kind: 'dynamic' (falls and bounces) | 'static' (solid: things hit it), bounce 0–1, slip 0–1, weight,
              push: [x, y, z] (units a second, at the start), spin: [x, y, z] (degrees a second), onHit: 'none' | 'vanish' | 'pop' }
   Shapes: a ball is a sphere; everything else is its box (the size it fills), turned with it. The floor is solid. */
(function () {
  'use strict';
  const T = window.THREE, E = window.E3;
  const d2r = (d) => (d * Math.PI) / 180, r2d = (r) => (r * 180) / Math.PI;
  const DEFAULTS = { kind: 'dynamic', bounce: 0.5, slip: 0.3, weight: 1, push: [0, 0, 0], spin: [0, 0, 0], onHit: 'none' };

  // the size an object fills, in its own turned frame (its build, with its own turn taken away), and its middle
  function bodyBox(m) {
    const o = E.object3d(m.id); if (!o) return null;
    const keep = { p: o.position.clone(), q: o.quaternion.clone() };
    o.position.set(0, 0, 0); o.quaternion.identity(); o.updateMatrixWorld(true);
    const b = new T.Box3(); o.traverse((x) => { if (x.isMesh && !x.userData.fur && !x.userData.mirrorView && !x.userData.helper) b.expandByObject(x); });
    o.position.copy(keep.p); o.quaternion.copy(keep.q); o.updateMatrixWorld(true);
    if (b.isEmpty()) return null;
    return { size: b.getSize(new T.Vector3()), centre: b.getCenter(new T.Vector3()) };
  }

  // Work it out: length seconds at fps frames a second (steps of 1/240 s); returns the keys and the hits
  function run({ length, fps = 30, gravity = 1 } = {}) {
    if (!window.CANNON) throw new Error('The physics library is missing from lib/craft3d-libs.js.');
    const C = window.CANNON, doc = E.doc;
    const world = new C.World({ gravity: new C.Vec3(0, -9.82 * gravity, 0) });
    world.broadphase = new C.SAPBroadphase(world); world.allowSleep = false;
    world.defaultContactMaterial.contactEquationStiffness = 1e7;
    // the floor
    const floor = new C.Body({ mass: 0, shape: new C.Plane() }); floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floor);
    const bodies = [], byBody = new Map();
    doc.objects.filter((m) => m.phys && m.phys.kind && !m.parent && m.visible !== false).forEach((m) => {
      const p = { ...DEFAULTS, ...m.phys }, box = bodyBox(m); if (!box) return;
      const ball = m.kind === 'shape' && m.shape.type === 'sphere';
      const shape = ball ? new C.Sphere(Math.max(box.size.x, box.size.y, box.size.z) / 2) : new C.Box(new C.Vec3(Math.max(0.01, box.size.x / 2), Math.max(0.01, box.size.y / 2), Math.max(0.01, box.size.z / 2)));
      const mat = new C.Material({ friction: Math.max(0, 1 - (p.slip ?? 0.3)) * 0.6, restitution: Math.max(0, Math.min(1, p.bounce ?? 0.5)) });
      const body = new C.Body({ mass: p.kind === 'dynamic' ? Math.max(0.01, p.weight || 1) : 0, material: mat, linearDamping: 0.02, angularDamping: 0.05 });
      // the box's middle may be off the object's own centre: the shape is placed there, so the object keeps its place
      const q = new T.Quaternion().setFromEuler(new T.Euler(...(m.rot || [0, 0, 0]).map(d2r)));
      body.addShape(shape, new C.Vec3(box.centre.x, box.centre.y, box.centre.z));
      body.position.set(...(m.pos || [0, 0, 0])); body.quaternion.set(q.x, q.y, q.z, q.w);
      if (p.kind === 'dynamic') { body.velocity.set(...(p.push || [0, 0, 0]).map(Number)); body.angularVelocity.set(...(p.spin || [0, 0, 0]).map((v) => d2r(+v || 0))); }
      world.addBody(body);
      const rec = { m, body, p, keys: { pos: [], rot: [], scale: [] }, last: null, gone: false, hitAt: null };
      bodies.push(rec); byBody.set(body, rec);
    });
    if (!bodies.some((b) => b.p.kind === 'dynamic')) throw new Error('Nothing is set to fall and bounce: select an object and set Physics › Falls and bounces.');
    // contact materials so each pair bounces by the bouncier of the two (and the floor by the object's own bounce)
    const hits = [];
    let now = 0;
    bodies.forEach((r) => r.body.addEventListener('collide', (e) => {
      const other = byBody.get(e.body), name = other ? other.m.name : 'the floor';
      // each hit is listed once (both objects hear about it), and not again while they stay touching
      const same = other && hits.some((h) => Math.abs(h.t - now) < 0.002 && h.b === r.m.name && h.a === name);
      if (!same && !hits.some((h) => h.a === r.m.name && h.b === name && now - h.t < 0.25)) hits.push({ t: +now.toFixed(3), a: r.m.name, b: name });
      if (r.p.onHit !== 'none' && r.hitAt == null && r.p.kind === 'dynamic') r.hitAt = now;
    }));
    const dt = 1 / 240, frame = 1 / fps, frames = Math.round(length * fps);
    const sample = (r, t) => {
      const b = r.body, q = new T.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w), e = new T.Euler().setFromQuaternion(q, 'XYZ'), rot = [r2d(e.x), r2d(e.y), r2d(e.z)];
      // angles kept continuous (no jumps of 360°), so the moves between frames turn the short way
      if (r.last) rot.forEach((v, i) => { while (v - r.last[i] > 180) v -= 360; while (v - r.last[i] < -180) v += 360; rot[i] = v; });
      r.last = rot;
      r.keys.pos.push({ t: +t.toFixed(4), v: [b.position.x, b.position.y, b.position.z].map((v) => +v.toFixed(4)), ease: 'linear' });
      r.keys.rot.push({ t: +t.toFixed(4), v: rot.map((v) => +v.toFixed(2)), ease: 'linear' });
    };
    bodies.forEach((r) => { if (r.p.kind === 'dynamic') sample(r, 0); });
    for (let f = 1; f <= frames; f++) {
      const until = f * frame;
      while (now < until - 1e-9) { world.step(dt); now += dt; }
      bodies.forEach((r) => {
        if (r.p.kind !== 'dynamic' || r.gone) return;
        sample(r, until);
        if (r.hitAt != null) {
          // vanish: shrink away; pop: swell, then gone. Then it leaves the world, so nothing more hits it.
          const t0 = r.hitAt, s = r.p.onHit === 'pop' ? [{ t: t0, v: [1, 1, 1] }, { t: t0 + 0.07, v: [1.45, 1.45, 1.45] }, { t: t0 + 0.16, v: [0, 0, 0] }] : [{ t: t0, v: [1, 1, 1] }, { t: t0 + 0.15, v: [0, 0, 0] }];
          r.keys.scale.push(...s.map((k) => ({ t: +k.t.toFixed(4), v: k.v, ease: 'linear' })));
          world.removeBody(r.body); r.gone = true;
        }
      });
    }
    return { bodies: bodies.filter((r) => r.p.kind === 'dynamic'), hits };
  }

  // Put the result on the timeline: each moving object's place and turn keys (and scale for vanish/pop) replace its own
  function bake(opts = {}) {
    const doc = E.doc; if (!doc.anim) doc.anim = { length: 5, fps: 30, loop: false, tracks: {} };
    const length = opts.length || doc.anim.length || 5, res = run({ length, fps: doc.anim.fps || 30, gravity: opts.gravity ?? 1 });
    res.bodies.forEach((r) => {
      const tr = doc.anim.tracks[r.m.id] || (doc.anim.tracks[r.m.id] = { keys: {} }); tr.keys = tr.keys || {};
      tr.keys.pos = r.keys.pos; tr.keys.rot = r.keys.rot;
      if (r.keys.scale.length) tr.keys.scale = [{ t: 0, v: [...(r.m.scale || [1, 1, 1])], ease: 'linear' }, ...r.keys.scale.map((k) => ({ ...k, v: k.v.map((x, i) => x * (r.m.scale || [1, 1, 1])[i]) }))];
      else if (tr.keys.scale && tr.keys.scale.some((k) => k.physics)) delete tr.keys.scale;
      tr.physics = true;
    });
    return res;
  }
  // take the worked-out moves away again
  function clear() {
    const doc = E.doc; if (!doc.anim) return 0; let n = 0;
    Object.entries(doc.anim.tracks).forEach(([id, tr]) => { if (tr.physics) { delete tr.keys.pos; delete tr.keys.rot; delete tr.keys.scale; delete tr.physics; n++; } });
    return n;
  }
  window.PHYS = { DEFAULTS, run, bake, clear };
})();
