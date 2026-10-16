/* 3DCraft engine: the scene model, building three.js objects from it, one or four views, picking, the move/turn/size
   handles, the corner rotator, studio lighting, pictures of the scene and 3D files in and out. */
(function () {
  'use strict';
  const T = window.THREE;
  const E = (window.E3 = { listeners: {} });
  E.on = (ev, fn) => (E.listeners[ev] = E.listeners[ev] || []).push(fn);
  const emit = (ev, ...a) => (E.listeners[ev] || []).forEach((fn) => fn(...a));
  const d2r = (d) => (d * Math.PI) / 180, r2d = (r) => (r * 180) / Math.PI;
  const uid = () => 'o' + Math.random().toString(36).slice(2, 9);
  E.uid = uid;

  // ------------------------------------------------------------------ the document
  // doc = { app, version, name, objects: [obj], scene: {...}, camera: {...}, fonts: {} }
  // obj = { id, name, kind: shape | text | trace | model | group, parent, visible, locked, pos, rot (degrees), scale, mat, ... }
  E.newDoc = (o = {}) => ({ app: '3DCraft', version: 1, name: o.name || 'My scene', objects: [],
    scene: { bg: { type: 'gradient', c1: '#eef2f7', c2: '#9fb3cc', angle: 0 }, ground: true, groundColor: '#e9e6df', shadow: 0.35, light: 'studio', lightPower: 1, lightAngle: 35, reflect: 1 },
    camera: { pos: [6, 4.5, 8], target: [0, 1, 0], fov: 40 } });
  E.doc = null;

  // Material presets: what the Material tab's buttons set.
  E.MATERIALS = {
    plastic: ['Plastic', { metal: 0, rough: 0.35, coat: 0.3, glass: 0, glow: 0 }],
    gloss: ['Glossy paint', { metal: 0, rough: 0.12, coat: 1, glass: 0, glow: 0 }],
    matte: ['Matte', { metal: 0, rough: 0.9, coat: 0, glass: 0, glow: 0 }],
    gold: ['Gold', { color: '#e6b422', metal: 1, rough: 0.22, coat: 0, glass: 0, glow: 0 }],
    silver: ['Silver', { color: '#d8dade', metal: 1, rough: 0.18, coat: 0, glass: 0, glow: 0 }],
    chrome: ['Chrome', { color: '#ffffff', metal: 1, rough: 0.04, coat: 0, glass: 0, glow: 0 }],
    copper: ['Copper', { color: '#c8703f', metal: 1, rough: 0.28, coat: 0, glass: 0, glow: 0 }],
    glass: ['Glass', { color: '#ffffff', metal: 0, rough: 0.03, coat: 0, glass: 1, glow: 0 }],
    glow: ['Glow', { metal: 0, rough: 0.6, coat: 0, glass: 0, glow: 1.6 }],
    rubber: ['Rubber', { metal: 0, rough: 1, coat: 0, glass: 0, glow: 0 }],
  };
  E.defaultMat = (color = '#3f7fe0', preset = 'plastic') => ({ preset, color, ...E.MATERIALS[preset][1], ...(E.MATERIALS[preset][1].color ? {} : { color }), opacity: 1, faces: {} });

  // Shapes: [name, defaults]. Sizes are in scene units (about 1 unit = 10 cm).
  E.SHAPES = {
    box: ['Box', { w: 2, h: 2, d: 2 }], roundbox: ['Rounded box', { w: 2, h: 2, d: 2, round: 0.25 }], sphere: ['Sphere', { r: 1.2 }],
    cylinder: ['Cylinder', { r: 1, h: 2 }], cone: ['Cone', { r: 1.1, h: 2.2 }], pyramid: ['Pyramid', { r: 1.4, h: 2 }], prism: ['Prism', { r: 1, h: 2, sides: 6 }],
    torus: ['Ring (doughnut)', { r: 1.1, tube: 0.4 }], washer: ['Flat ring', { r: 1.3, hole: 0.7, d: 0.4 }], capsule: ['Capsule', { r: 0.7, h: 1.6 }],
    star: ['Star', { r: 1.4, inner: 0.55, points: 5, d: 0.5 }], heart: ['Heart', { r: 1.4, d: 0.5 }], plane: ['Flat panel', { w: 3, h: 2 }],
  };

  // ------------------------------------------------------------------ three.js setup
  let renderer, scene, root, ground, grid, keyLight, fillLight, envTex, pmrem, tc, orbit;
  const views = []; // { name, el, cam, ortho, zoom }
  let layout = 'one', host, overlay, selected = null, needs = true;
  E.init = function (hostEl) {
    host = hostEl;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.className = 'gl';
    host.append(renderer.domElement);
    overlay = document.createElement('div'); overlay.className = 'views'; host.append(overlay);
    scene = new T.Scene();
    pmrem = new T.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    root = new T.Group(); root.name = 'objects'; scene.add(root);
    keyLight = new T.DirectionalLight(0xffffff, 2.2); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight, keyLight.target);
    fillLight = new T.HemisphereLight(0xffffff, 0x8899aa, 0.5); scene.add(fillLight);
    ground = new T.Group();
    const gShadow = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.35 })); gShadow.rotation.x = -Math.PI / 2; gShadow.receiveShadow = true; gShadow.name = 'shadow';
    const gColor = new T.Mesh(new T.CircleGeometry(60, 64), new T.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.95 })); gColor.rotation.x = -Math.PI / 2; gColor.position.y = -0.002; gColor.receiveShadow = true; gColor.name = 'floor';
    ground.add(gColor, gShadow); scene.add(ground);
    grid = new T.GridHelper(40, 40, 0x8899aa, 0xc5ccd6); grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.001; grid.userData.helper = true; scene.add(grid);
    // the move / turn / size handles
    tc = new T.TransformControls(new T.PerspectiveCamera(), overlay);
    tc.setSize(0.9);
    const tcHelper = tc.getHelper(); tcHelper.userData.helper = true; scene.add(tcHelper);
    tc.addEventListener('dragging-changed', (e) => { views.forEach((v) => v.orbit && (v.orbit.enabled = !e.value)); if (!e.value) { syncFromObject(selected); emit('changed'); } });
    tc.addEventListener('objectChange', () => { needs = true; emit('moving'); });
    setLayout('one');
    new ResizeObserver(() => { needs = true; }).observe(host);
    const loop = () => { requestAnimationFrame(loop); if (needs && !E.busy) { needs = false; draw(); } };
    loop();
  };
  E.redraw = () => { needs = true; };

  // ------------------------------------------------------------------ views: one big view, or top / front / right / 3D
  function makeView(name, kind) {
    const el = document.createElement('div'); el.className = 'view'; el.dataset.view = name;
    el.innerHTML = `<span class="view-name">${name}</span>`;
    overlay.append(el);
    let cam, ortho = kind !== 'persp';
    if (ortho) { cam = new T.OrthographicCamera(-5, 5, 5, -5, -500, 500); const dir = { top: [0, 1, 0.0001], front: [0, 0, 1], right: [1, 0, 0] }[kind]; cam.position.set(...dir).multiplyScalar(50); cam.lookAt(0, 0, 0); if (kind === 'top') cam.up.set(0, 0, -1), cam.lookAt(0, 0, 0); }
    else cam = new T.PerspectiveCamera(40, 1, 0.05, 2000);
    const v = { name, kind, el, cam, ortho, zoom: 1 };
    if (!ortho) {
      v.orbit = new T.OrbitControls(cam, el); v.orbit.enableDamping = false; v.orbit.screenSpacePanning = true;
      v.orbit.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.PAN, RIGHT: T.MOUSE.PAN }; // middle over an object drags it (below); over empty space it slides the view
      v.orbit.addEventListener('change', () => { needs = true; emit('view'); });
    } else {
      el.addEventListener('wheel', (e) => { e.preventDefault(); v.zoom = Math.max(0.1, Math.min(20, v.zoom * (e.deltaY > 0 ? 0.9 : 1.1))); needs = true; }, { passive: false });
    }
    picking(v);
    return v;
  }
  function setLayout(mode) {
    layout = mode;
    const keepCam = views.find((v) => !v.ortho);
    const camState = keepCam ? { pos: keepCam.cam.position.toArray(), target: keepCam.orbit.target.toArray() } : null;
    views.splice(0).forEach((v) => { v.orbit && v.orbit.dispose(); v.el.remove(); });
    overlay.className = 'views ' + mode;
    if (mode === 'four') { views.push(makeView('Top', 'top'), makeView('Front', 'front'), makeView('Right', 'right'), makeView('3D', 'persp')); }
    else views.push(makeView('3D', 'persp'));
    const p = views.find((v) => !v.ortho);
    if (camState) { p.cam.position.fromArray(camState.pos); p.orbit.target.fromArray(camState.target); p.orbit.update(); } else applyCamera();
    attachHandles(p);
    emit('layout', mode); needs = true;
  }
  E.setLayout = setLayout; E.layout = () => layout;
  E.mainView = () => views.find((v) => !v.ortho);
  function attachHandles(v) {
    if (tc.camera === v.cam && tc.domElement === v.el) return;
    tc.disconnect(); tc.camera = v.cam; tc.connect(v.el);
  }
  // the size of the scene, for fitting ortho views and the camera
  function sceneBox() { const b = new T.Box3().setFromObject(root); if (b.isEmpty()) b.set(new T.Vector3(-2, 0, -2), new T.Vector3(2, 2, 2)); return b; }
  function draw() {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return;
    if (renderer.domElement.width !== Math.round(W * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(H * renderer.getPixelRatio())) renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
    renderer.setScissorTest(true);
    const box = sceneBox(), c = box.getCenter(new T.Vector3()), rad = Math.max(2, box.getSize(new T.Vector3()).length() * 0.75);
    views.forEach((v) => {
      const r = v.el.getBoundingClientRect(), hr = host.getBoundingClientRect();
      const x = r.left - hr.left, y = H - (r.top - hr.top) - r.height, w = r.width, h = r.height;
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      if (v.ortho) {
        const s = rad / v.zoom, a = w / h; v.cam.left = -s * a; v.cam.right = s * a; v.cam.top = s; v.cam.bottom = -s;
        const dir = v.cam.position.clone().normalize(); v.cam.position.copy(c).addScaledVector(dir, 100); v.cam.lookAt(c); v.cam.updateProjectionMatrix();
      } else { v.cam.aspect = w / h; v.cam.updateProjectionMatrix(); }
      grid.visible = E.showGrid !== false;
      renderer.render(scene, v.cam);
    });
    renderer.setScissorTest(false);
    emit('drawn');
  }

  // ------------------------------------------------------------------ picking and selecting
  const ray = new T.Raycaster();
  // what is under the pointer in a view: the top-level object (or its group), skipping locked and hidden things
  function hitAt(e, v) {
    const r = v.el.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), v.cam);
    for (const h of ray.intersectObjects(root.children, true)) {
      let o = h.object; if (!o.visible) continue;
      while (o && !o.userData.id) o = o.parent;
      while (o && o.parent && o.parent !== root && o.parent.userData.id && o.parent.userData.kind === 'group') o = o.parent;
      const m = o && E.find(o.userData.id); if (m && !m.locked) return o;
    }
    return null;
  }
  function pointOnPlane(e, v, plane) {
    const r = v.el.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), v.cam);
    return ray.ray.intersectPlane(plane, new T.Vector3());
  }
  function picking(v) {
    let down = null, mdrag = null;
    v.el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; if (v !== views.find((x) => x.el === tc.domElement)) attachHandles(v); }, true);
    // hold the middle mouse button on an object to drag it: it slides in the plane facing you (over empty space the view pans)
    v.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      const hit = hitAt(e, v); if (!hit) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (selected !== hit) E.select(hit.userData.id);
      const wp = hit.getWorldPosition(new T.Vector3()), plane = new T.Plane().setFromNormalAndCoplanarPoint(v.cam.getWorldDirection(new T.Vector3()), wp);
      const start = pointOnPlane(e, v, plane); if (!start) return;
      mdrag = { o: hit, plane, offset: wp.clone().sub(start), id: e.pointerId };
      try { v.el.setPointerCapture(e.pointerId); } catch (er) {} if (v.orbit) v.orbit.enabled = false; v.el.style.cursor = 'grabbing';
    }, true);
    v.el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no browser auto-scroll
    v.el.addEventListener('pointermove', (e) => {
      if (!mdrag) return;
      const p = pointOnPlane(e, v, mdrag.plane); if (!p) return;
      const world = p.add(mdrag.offset), o = mdrag.o;
      o.position.copy(o.parent.worldToLocal(world)); o.updateMatrixWorld(); needs = true; emit('moving');
    }, true);
    v.el.addEventListener('pointerup', (e) => {
      if (!mdrag || e.button !== 1) return;
      syncFromObject(mdrag.o); mdrag = null; if (v.orbit) v.orbit.enabled = true; v.el.style.cursor = ''; emit('changed');
    }, true);
    v.el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.dragging) { down = null; return; }
      down = null;
      const hit = hitAt(e, v);
      E.select(hit ? hit.userData.id : null);
    });
  }
  E.select = function (id) {
    selected = id ? root.getObjectByProperty('uid', id) || null : null;
    if (selected) { tc.attach(selected); } else tc.detach();
    needs = true; emit('select', E.selectedId());
  };
  E.selectedId = () => (selected ? selected.userData.id : null);
  E.setMode = (m) => { tc.setMode(m); emit('mode', m); };
  E.mode = () => tc.mode;
  E.setSpace = (s) => tc.setSpace(s);

  // ------------------------------------------------------------------ model lookups
  E.find = (id) => E.doc && E.doc.objects.find((o) => o.id === id);
  E.children = (id) => E.doc.objects.filter((o) => (o.parent || null) === (id || null));
  // after the handles move something, copy where it is back into the model
  function syncFromObject(o) {
    if (!o) return;
    const m = E.find(o.userData.id); if (!m) return;
    E.setValue(m, 'pos', o.position.toArray().map((v) => +v.toFixed(4)));
    E.setValue(m, 'rot', [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +r2d(v).toFixed(2)));
    E.setValue(m, 'scale', o.scale.toArray().map((v) => +v.toFixed(4)));
  }
  E.syncSelected = () => syncFromObject(selected);

  // ------------------------------------------------------------------ geometry
  // Each geometry gets material groups with names, so pictures and gradients can go on the front, back, sides, top or bottom.
  function splitExtrude(geo, box) {
    // ExtrudeGeometry has caps (front and back together) and sides: put them in three groups (0 front, 1 back, 2 sides)
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeBoundingBox();
    const bb = g.boundingBox, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const zMid = (bb.min.z + bb.max.z) / 2, buckets = [[], [], []];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    groups.forEach((gr) => { for (let i = gr.start; i < gr.start + gr.count; i += 3) { let b = 2; if (gr.materialIndex === 0) { const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3; b = z > zMid ? 0 : 1; } buckets[b].push(i, i + 1, i + 2); } });
    const order = [...buckets[0], ...buckets[1], ...buckets[2]];
    const P = new Float32Array(order.length * 3), N = new Float32Array(order.length * 3), U = new Float32Array(order.length * 2);
    const bx = box || { min: bb.min, max: bb.max }, w = bx.max.x - bx.min.x || 1, h = bx.max.y - bx.min.y || 1, dz = bb.max.z - bb.min.z || 1;
    order.forEach((src, k) => {
      const x = pos.getX(src), y = pos.getY(src), z = pos.getZ(src);
      P.set([x, y, z], k * 3); N.set([nor.getX(src), nor.getY(src), nor.getZ(src)], k * 3);
      const b = k < buckets[0].length ? 0 : k < buckets[0].length + buckets[1].length ? 1 : 2;
      // pictures fit the whole outline on the front and back; on the sides they run from front to back
      if (b === 0) U.set([(x - bx.min.x) / w, (y - bx.min.y) / h], k * 2);
      else if (b === 1) U.set([1 - (x - bx.min.x) / w, (y - bx.min.y) / h], k * 2);
      else U.set([uv ? (uv.getX(src) - bx.min.x) / Math.max(w, h) : 0, (bb.max.z - z) / dz], k * 2);
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(U, 2));
    out.addGroup(0, buckets[0].length, 0); out.addGroup(buckets[0].length, buckets[1].length, 1); out.addGroup(buckets[0].length + buckets[1].length, buckets[2].length, 2);
    return out;
  }
  const extrudeShapes = (shapes, depth, bevel = 0, curve = 10, box = null) => {
    const geo = new T.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: bevel > 0 ? 4 : 0, curveSegments: curve });
    geo.translate(0, 0, -depth / 2);
    return splitExtrude(geo, box);
  };
  const SLOTS = { box: ['sides', 'sides', 'top', 'bottom', 'front', 'back'], cyl: ['sides', 'top', 'bottom'], extrude: ['front', 'back', 'sides'] };
  function shapeGeo(s) {
    const p = { ...E.SHAPES[s.type][1], ...s };
    switch (s.type) {
      case 'box': return [new T.BoxGeometry(p.w, p.h, p.d), SLOTS.box];
      case 'roundbox': return [new T.RoundedBoxGeometry(p.w, p.h, p.d, 6, Math.min(p.round, Math.min(p.w, p.h, p.d) / 2 - 0.001)), SLOTS.box];
      case 'sphere': return [new T.SphereGeometry(p.r, 64, 40), null];
      case 'cylinder': return [new T.CylinderGeometry(p.r, p.r, p.h, 64), SLOTS.cyl];
      case 'cone': return [new T.CylinderGeometry(0, p.r, p.h, 64), SLOTS.cyl];
      case 'pyramid': { const g = new T.CylinderGeometry(0, p.r, p.h, 4); g.rotateY(Math.PI / 4); return [g, SLOTS.cyl]; }
      case 'prism': return [new T.CylinderGeometry(p.r, p.r, p.h, Math.max(3, Math.min(24, p.sides | 0))), SLOTS.cyl];
      case 'torus': return [new T.TorusGeometry(p.r, p.tube, 32, 96), null];
      case 'capsule': return [new T.CapsuleGeometry(p.r, p.h, 12, 32), null];
      case 'plane': { const g = new T.PlaneGeometry(p.w, p.h); return [g, null]; }
      case 'washer': { const sh = new T.Shape().absarc(0, 0, p.r, 0, Math.PI * 2, false); sh.holes.push(new T.Path().absarc(0, 0, Math.min(p.hole, p.r - 0.05), 0, Math.PI * 2, true)); return [extrudeShapes([sh], p.d, 0, 64), SLOTS.extrude]; }
      case 'star': { const sh = new T.Shape(), n = Math.max(3, p.points | 0); for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n + Math.PI / 2, r = i % 2 ? p.r * p.inner : p.r; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return [extrudeShapes([sh], p.d, p.d * 0.1), SLOTS.extrude]; }
      case 'heart': { const k = p.r / 1.2, sh = new T.Shape(); sh.moveTo(0, -1.1 * k); sh.bezierCurveTo(-0.3 * k, -0.75 * k, -1.2 * k, -0.25 * k, -1.2 * k, 0.35 * k); sh.bezierCurveTo(-1.2 * k, 0.95 * k, -0.45 * k, 1.15 * k, 0, 0.6 * k); sh.bezierCurveTo(0.45 * k, 1.15 * k, 1.2 * k, 0.95 * k, 1.2 * k, 0.35 * k); sh.bezierCurveTo(1.2 * k, -0.25 * k, 0.3 * k, -0.75 * k, 0, -1.1 * k); return [extrudeShapes([sh], p.d, p.d * 0.1, 24), SLOTS.extrude]; }
      default: return [new T.BoxGeometry(1, 1, 1), SLOTS.box];
    }
  }
  // 3D text: letter outlines from the font (opentype.js), pulled out to a depth, with an optional bevel.
  const fontCache = new Map();
  E.loadFont = (family, weight = '400') => {
    const list = (window.CRAFT_FONTS3D || []).find(([f]) => f === family) || (window.CRAFT_FONTS3D || [])[0];
    if (!list) return Promise.reject(new Error('No 3D fonts (fonts/fonts3d.js)'));
    const file = list[2][weight] || list[2]['400'] || Object.values(list[2])[0], key = file;
    if (!fontCache.has(key)) fontCache.set(key, fontBytes(file).then((b) => opentype.parse(b)));
    return fontCache.get(key);
  };
  // Pages opened from the folder (file://) cannot fetch the .ttf, so each font also comes as a script
  // (fonts/3d/Name-400.js, written by fetch_fonts.py) that puts the font into CRAFT_FONT_DATA as base64.
  function fontBytes(file) {
    const data = () => (window.CRAFT_FONT_DATA || {})[file];
    const decode = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    if (data()) return Promise.resolve(decode(data()));
    return new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = 'fonts/' + file.replace(/\.ttf$/, '.js');
      sc.onload = () => (data() ? res(decode(data())) : rej(new Error('Font script empty: ' + file)));
      sc.onerror = () => fetch('fonts/' + file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(res, rej);
      document.head.append(sc);
    });
  }
  function textShapes(font, t) {
    const size = 1, lines = String(t.text || ' ').split('\n'), lh = size * (t.lead || 1.15), loader = new T.SVGLoader();
    const shapes = [], widths = lines.map((ln) => font.getAdvanceWidth(ln, size * 100, { letterSpacing: (t.spacing || 0) / 1000 }) / 100);
    const maxW = Math.max(...widths);
    lines.forEach((ln, i) => {
      const x0 = t.align === 'left' ? -maxW / 2 : t.align === 'right' ? maxW / 2 - widths[i] : -widths[i] / 2;
      const path = font.getPath(ln, x0 * 100, (i * lh) * 100, size * 100, { letterSpacing: (t.spacing || 0) / 1000 });
      const d = path.toPathData(2); if (!d) return;
      // letters come with y going down: flip them while reading, so the outlines face the right way
      loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="${d}"/></g></svg>`).paths.forEach((p) => T.SVGLoader.createShapes(p).forEach((s) => shapes.push(s)));
    });
    return shapes;
  }
  // Text with a letter animation: every letter is its own piece (in the same place as in the whole word), so each can move.
  function letterGroup(font, m) {
    const t = m.text, size = 1, lines = String(t.text || ' ').split('\n'), lh = size * (t.lead || 1.15), loader = new T.SVGLoader();
    const opt = { letterSpacing: (t.spacing || 0) / 1000 }, widths = lines.map((ln) => font.getAdvanceWidth(ln, size * 100, opt) / 100), maxW = Math.max(...widths);
    const letters = [], box = new T.Box2();
    lines.forEach((ln, i) => {
      const x0 = t.align === 'left' ? -maxW / 2 : t.align === 'right' ? maxW / 2 - widths[i] : -widths[i] / 2;
      font.getPaths(ln, x0 * 100, (i * lh) * 100, size * 100, opt).forEach((gp) => {
        const d = gp.toPathData(2); if (!d) return;
        const shapes = [];
        loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="${d}"/></g></svg>`).paths.forEach((p) => T.SVGLoader.createShapes(p).forEach((sh) => shapes.push(sh)));
        if (!shapes.length) return;
        shapes.forEach((sh) => sh.getPoints().forEach((pt) => box.expandByPoint(pt)));
        letters.push(shapes);
      });
    });
    const k = (t.size || 1) / 100, g = new T.Group(), whole = new T.Box3();
    const geos = letters.map((shapes) => { const geo = extrudeShapes(shapes, (t.depth || 0.4) / (t.size || 1) * 100, (t.bevel || 0) / (t.size || 1) * 100, 8, box); geo.scale(k, k, k); geo.computeBoundingBox(); whole.union(geo.boundingBox); return geo; });
    const mid = whole.getCenter(new T.Vector3());
    geos.forEach((geo, i) => {
      geo.translate(-mid.x, -mid.y, -mid.z); geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new T.Vector3()); geo.translate(-c.x, -c.y, -c.z);
      const mesh = new T.Mesh(geo, materialsFor(m.mat, SLOTS.extrude)); mesh.position.copy(c);
      mesh.userData.letter = { i, home: c.clone() }; g.add(mesh);
    });
    g.userData.letters = geos.length;
    return g;
  }
  // Letter animations: styles that bring letters in (or take them out), and styles that loop
  E.LETTER_STYLES = {
    type: ['Typewriter (pop on)', 'in'], fade: ['Fade in', 'in'], drop: ['Drop in (with a bounce)', 'in'], rise: ['Rise up', 'in'], grow: ['Grow in', 'in'],
    spin: ['Spin in', 'in'], flip: ['Flip in', 'in'], slide: ['Slide in from the right', 'in'], scatter: ['Scatter (fly together)', 'in'],
    wave: ['Wave (keeps going)', 'loop'], jump: ['Jump (keeps going)', 'loop'], rock: ['Rock (keeps going)', 'loop'], sweep: ['Colour sweep (keeps going)', 'loop'],
  };
  E.LETTER_ORDERS = { left: 'First to last', right: 'Last to first', middle: 'From the middle out', edges: 'From the ends in', random: 'Random' };
  const backOut = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
  const rnd = (i, n) => { let h = (i + 1) * 374761393 + n * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  E.letterRank = function (i, n, order) {
    const mid = (n - 1) / 2;
    if (order === 'right') return n - 1 - i;
    if (order === 'middle') return Math.abs(i - mid);
    if (order === 'edges') return mid - Math.abs(i - mid);
    if (order === 'random') { const ids = [...Array(n).keys()].sort((a, b) => rnd(a, 7) - rnd(b, 7)); return ids.indexOf(i); }
    return i;
  };
  // how long the letters take, from the first starting to the last finishing
  E.lettersSpan = (L, n) => { const ranks = [...Array(n).keys()].map((i) => E.letterRank(i, n, L.order)); return Math.max(0, ...ranks) * (L.gap ?? 0.08) + (L.each ?? 0.5); };
  // where letter i is at time t: { dx, dy, dz (in letter sizes), rx, ry, rz (degrees), s, op, hue }
  function letterPose(L, i, n, t) {
    const out = { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 1, op: 1, hue: null }, amt = L.amount ?? 1, r = E.letterRank(i, n, L.order), gap = L.gap ?? 0.08;
    const kind = (E.LETTER_STYLES[L.style] || [])[1];
    if (kind === 'loop') {
      const ph = (t / Math.max(0.1, L.speed ?? 2) - r * gap) % 1, w = Math.sin(ph * Math.PI * 2);
      if (L.style === 'wave') out.dy = 0.3 * amt * w;
      else if (L.style === 'jump') out.dy = w > 0 ? 0.6 * amt * w * w : 0;
      else if (L.style === 'rock') out.rz = 15 * amt * w;
      else if (L.style === 'sweep') out.hue = ((ph % 1) + 1) % 1;
      return out;
    }
    const each = Math.max(0.02, L.each ?? 0.5), clamp = (x) => Math.max(0, Math.min(1, x));
    const uIn = clamp((t - (L.start ?? 0) - r * gap) / each), uOut = 1 - clamp((t - (L.leave ?? 0) - r * gap) / each);
    const u = L.mode === 'out' ? uOut : L.mode === 'both' ? Math.min(uIn, uOut) : uIn;
    const e = 1 - (1 - u) ** 3, rest = 1 - e;
    switch (L.style) {
      case 'type': out.op = u > 0 ? 1 : 0; out.s = u > 0 ? 1 + 0.3 * (1 - u) * (u < 1 ? 1 : 0) : 0; break;
      case 'fade': out.op = u; break;
      case 'drop': out.dy = 3 * amt * (1 - (u >= 1 ? 1 : bounceOut(u))); out.op = Math.min(1, u * 4); break;
      case 'rise': out.dy = -1.5 * amt * rest; out.op = u; break;
      case 'grow': out.s = u <= 0 ? 0 : backOut(u); out.op = Math.min(1, u * 3); break;
      case 'spin': out.ry = 360 * amt * rest; out.s = Math.sqrt(e); out.op = Math.min(1, u * 2); break;
      case 'flip': out.rx = -90 * amt * rest; out.op = Math.min(1, u * 2); break;
      case 'slide': out.dx = 4 * amt * rest; out.op = u; break;
      case 'scatter': { out.dx = (rnd(i, 1) * 2 - 1) * 5 * amt * rest; out.dy = (rnd(i, 2) * 2 - 1) * 4 * amt * rest; out.dz = (rnd(i, 3) * 2 - 1) * 5 * amt * rest; out.rx = (rnd(i, 4) * 2 - 1) * 270 * rest; out.ry = (rnd(i, 5) * 2 - 1) * 270 * rest; out.rz = (rnd(i, 6) * 2 - 1) * 180 * rest; out.op = Math.min(1, u * 2); break; }
    }
    return out;
  }
  // put every letter of a lettered text where it is at time tt (or back home when there is no letter animation)
  function poseLetters(m, o, tr, tt, baseOp) {
    const L = tr && tr.letters, n = o.userData.letters, size = (m.text && m.text.size) || 1;
    o.children.forEach((x) => {
      const info = x.userData.letter; if (!info) return;
      const q = L && E.LETTER_STYLES[L.style] ? letterPose(L, info.i, n, tt) : { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 1, op: 1, hue: null };
      x.position.set(info.home.x + q.dx * size, info.home.y + q.dy * size, info.home.z + q.dz * size);
      x.rotation.set(d2r(q.rx), d2r(q.ry), d2r(q.rz)); x.scale.setScalar(Math.max(0.001, q.s));
      x.visible = q.op > 0.002 && q.s > 0.002;
      [].concat(x.material).forEach((mt) => {
        mt.opacity = baseOp * q.op; mt.transparent = mt.opacity < 1 || mt.transmission > 0;
        // the colour sweep paints plain faces; otherwise they keep the colour they were built with
        if (!mt.map && !(tr && tr.keys && tr.keys.color)) { if (!mt.userData.base) mt.userData.base = mt.color.clone(); if (q.hue != null) mt.color.setHSL(q.hue, 0.75, 0.55); else mt.color.copy(mt.userData.base); }
      });
    });
  }
  // A traced picture: every colour's outlines pulled out (from the SVG the tracer made), as one group.
  function traceGroup(m) {
    // pictures have y going down: flip the outlines while reading them
    const flipped = m.trace.svg.replace(/(<svg[^>]*>)/, '$1<g transform="scale(1,-1)">').replace(/<\/svg>\s*$/, '</g></svg>');
    const g = new T.Group(), data = new T.SVGLoader().parse(flipped), tr = m.trace;
    const box = new T.Box2(); data.paths.forEach((p) => p.subPaths.forEach((sp) => sp.getPoints().forEach((pt) => box.expandByPoint(pt))));
    const size = box.getSize(new T.Vector2()), k = (tr.width || 4) / Math.max(size.x, size.y, 1), c = box.getCenter(new T.Vector2());
    data.paths.forEach((p, i) => {
      const shapes = T.SVGLoader.createShapes(p); if (!shapes.length) return;
      const col = '#' + p.color.getHexString(), layerDepth = (tr.depth || 0.4) * (tr.stepped ? 1 + (i % 4) * 0.25 : 1);
      shapes.forEach((s) => { s.getPoints(); });
      const geo = extrudeShapes(shapes, layerDepth / k, (tr.bevel || 0) / k, 6);
      geo.translate(-c.x, -c.y, 0); geo.scale(k, k, k);
      const mat = tr.ownColours !== false ? { ...m.mat, color: col, faces: m.mat.faces } : m.mat;
      const mesh = new T.Mesh(geo, materialsFor(mat, SLOTS.extrude)); mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.z = tr.stepped ? (i % 4) * 0.01 : i * 0.0005;
      g.add(mesh);
    });
    return g;
  }

  // ------------------------------------------------------------------ materials
  const texCache = new Map();
  function faceTexture(f) {
    if (!f || f.type === 'none' || f.type === 'solid') return null;
    const key = JSON.stringify(f); if (texCache.has(key)) return texCache.get(key);
    const tex = new T.CanvasTexture(document.createElement('canvas')); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const draw = (img) => { tex.image = window.paintCanvas ? window.paintCanvas(1024, 1024, f, img, 1024 / 40) : document.createElement('canvas'); tex.needsUpdate = true; needs = true; };
    if (f.type === 'picture' && f.src) { const i = new Image(); i.onload = () => draw(i); i.src = f.src; } else draw(null);
    if (f.type === 'pattern' || f.fit === 'tile') { tex.wrapS = tex.wrapT = T.RepeatWrapping; }
    texCache.set(key, tex); return tex;
  }
  function material(m, face) {
    const glass = m.glass || 0;
    const mat = new T.MeshPhysicalMaterial({
      color: new T.Color(m.color || '#cccccc'), metalness: m.metal ?? 0, roughness: m.rough ?? 0.4, clearcoat: m.coat || 0, clearcoatRoughness: 0.1,
      transmission: glass, thickness: glass ? 1 : 0, ior: 1.5, transparent: (m.opacity ?? 1) < 1, opacity: m.opacity ?? 1,
      emissive: m.glow ? new T.Color(m.color || '#ffffff') : new T.Color(0), emissiveIntensity: m.glow || 0,
    });
    // metals live on reflections; paint and plastic only need a little
    mat.envMap = envTex; mat.userData.reflect = (m.metal ?? 0) > 0.5 ? 1.5 : 0.6; mat.envMapIntensity = mat.userData.reflect * (E.doc ? E.doc.scene.reflect ?? 1 : 1);
    if (face && face.type === 'solid') mat.color.set(face.color || m.color);
    const tex = faceTexture(face);
    if (tex) { mat.map = tex; mat.color.set('#ffffff'); if (m.glow) mat.emissiveMap = tex, mat.emissive.set('#ffffff'); }
    return mat;
  }
  // one material per named face (front, back, sides, top, bottom), each with its own picture or gradient if set
  function materialsFor(m, slots) {
    const faces = m.faces || {};
    if (!slots) return material(m, faces.all);
    return slots.map((sl) => material(m, faces[sl] || faces.all));
  }
  E.slotsFor = (m) => (m.kind === 'shape' ? (shapeGeo(m.shape)[1] ? [...new Set(shapeGeo(m.shape)[1])] : []) : m.kind === 'text' || m.kind === 'trace' ? ['front', 'back', 'sides'] : []);

  // ------------------------------------------------------------------ building the scene from the model
  const built = new Map(); // id → Object3D
  async function buildOne(m) {
    let o;
    if (m.kind === 'group') o = new T.Group();
    else if (m.kind === 'shape') { const [geo, slots] = shapeGeo(m.shape); o = new T.Mesh(geo, materialsFor(m.mat, slots)); if (m.shape.type === 'plane') [].concat(o.material).forEach((x) => (x.side = T.DoubleSide)); }
    else if (m.kind === 'text') {
      let font;
      try { font = await E.loadFont(m.text.font, m.text.bold ? '700' : '400'); }
      catch (e) { console.warn('3D text font', e); E.onWarn?.('The font for 3D text could not be loaded (' + m.text.font + ').'); o = new T.Group(); o.userData = { id: m.id, kind: m.kind }; o.uid = m.id; place(o, m); return o; }
      const t = m.text, tr = E.doc.anim && E.doc.anim.tracks[m.id];
      if (tr && tr.letters && E.LETTER_STYLES[tr.letters.style]) o = letterGroup(font, m);
      else {
        const shapes = textShapes(font, t), geo = extrudeShapes(shapes, (t.depth || 0.4) / (t.size || 1) * 100, (t.bevel || 0) / (t.size || 1) * 100, 8);
        geo.scale((t.size || 1) / 100, (t.size || 1) / 100, (t.size || 1) / 100); geo.center();
        o = new T.Mesh(geo, materialsFor(m.mat, SLOTS.extrude));
      }
    }
    else if (m.kind === 'trace') o = traceGroup(m);
    else if (m.kind === 'model') o = await loadModel(m);
    else o = new T.Group();
    o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    Object.assign(o.userData, { id: m.id, kind: m.kind }); o.uid = m.id; o.name = m.name || m.kind;
    place(o, m);
    return o;
  }
  function place(o, m) {
    o.position.fromArray(m.pos || [0, 0, 0]);
    o.rotation.set(...(m.rot || [0, 0, 0]).map(d2r));
    o.scale.fromArray(m.scale || [1, 1, 1]);
    o.visible = m.visible !== false;
    if (m.kind !== 'group') o.traverse((x) => { if (x.isMesh) [].concat(x.material).forEach((mt) => { mt.transparent = (m.mat.opacity ?? 1) < 1 || mt.transmission > 0; }); });
  }
  let building = Promise.resolve();
  // Build everything again (on open, undo, and after changes to many things)
  E.rebuild = function () {
    building = building.then(async () => {
      const sel = E.selectedId();
      tc.detach(); root.clear(); built.clear(); texCache.clear();
      if (!E.doc) return;
      const make = async (parentId, parentObj) => { for (const m of E.children(parentId)) { let o; try { o = await buildOne(m); } catch (e) { console.warn('could not build', m, e); o = new T.Group(); o.userData = { id: m.id, kind: m.kind }; o.uid = m.id; } built.set(m.id, o); parentObj.add(o); if (m.kind === 'group') await make(m.id, o); } };
      await make(null, root);
      applyScene();
      if (E.doc.anim) E.evalAt(E.time);
      if (sel && built.has(sel)) E.select(sel); else E.select(null);
      needs = true; emit('built');
    });
    return building;
  };
  // Rebuild one object (after its shape, words or material changed), keeping it selected
  E.rebuildOne = function (id) {
    building = building.then(async () => {
      const m = E.find(id), old = built.get(id); if (!m || !old) return;
      const o = await buildOne(m); const parent = old.parent;
      if (m.kind === 'group') [...old.children].forEach((c) => o.add(c));
      parent.add(o); parent.remove(old); built.set(id, o);
      old.traverse((x) => { if (x.isMesh) x.geometry.dispose(); });
      if (E.selectedId() === id || selected === old) { selected = o; tc.attach(o); }
      if (E.doc.anim) E.evalAt(E.time);
      needs = true; emit('built');
    });
    return building;
  };
  E.placeOne = (id) => { const m = E.find(id), o = built.get(id); if (m && o) { place(o, m); if (E.doc.anim) E.evalAt(E.time); needs = true; } };
  E.object3d = (id) => built.get(id);

  // ------------------------------------------------------------------ lights, background, ground
  const LIGHTS = { studio: ['Studio', 0xffffff, 2.2, 0.55], sunset: ['Sunset', 0xffb070, 2.4, 0.35], night: ['Night', 0x9fb8ff, 1.2, 0.18], dramatic: ['Dramatic', 0xffffff, 3.2, 0.08], soft: ['Soft', 0xffffff, 1.3, 0.9] };
  E.LIGHTS = LIGHTS;
  let bgTex = null;
  function applyScene() {
    const s = E.doc.scene, L = LIGHTS[s.light] || LIGHTS.studio, a = d2r(s.lightAngle ?? 35);
    keyLight.color.set(L[1]); keyLight.intensity = L[2] * (s.lightPower ?? 1);
    fillLight.intensity = L[3] * (s.lightPower ?? 1);
    const box = sceneBox(), c = box.getCenter(new T.Vector3()), r = Math.max(6, box.getSize(new T.Vector3()).length());
    keyLight.position.set(c.x + Math.sin(a) * r, c.y + r * 1.1, c.z + Math.cos(a) * r); keyLight.target.position.copy(c);
    const sc = keyLight.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.1; sc.far = r * 4; sc.updateProjectionMatrix();
    scene.environmentIntensity = 0.8 * (s.reflect ?? 1); // for models that bring their own materials
    root.traverse((x) => { if (x.isMesh) [].concat(x.material).forEach((mt) => { if (mt.userData && mt.userData.reflect) mt.envMapIntensity = mt.userData.reflect * (s.reflect ?? 1); }); });
    ground.visible = !!s.ground; ground.position.y = box.isEmpty() ? 0 : Math.min(0, box.min.y);
    ground.getObjectByName('floor').visible = !!s.groundColor && s.groundStyle !== 'shadow';
    ground.getObjectByName('floor').material.color.set(s.groundColor || '#e9e6df');
    ground.getObjectByName('shadow').material.opacity = s.shadow ?? 0.35;
    if (bgTex) { bgTex.dispose(); bgTex = null; }
    const bg = s.bg || { type: 'none' };
    if (bg.type === 'solid') scene.background = new T.Color(bg.color || '#ffffff');
    else if (bg.type === 'gradient' || bg.type === 'pattern' || bg.type === 'picture') {
      const draw = (img) => { bgTex = new T.CanvasTexture(window.paintCanvas(1024, 1024, { ...bg, angle: bg.angle ?? 0 }, img, 1024 / 40)); bgTex.colorSpace = T.SRGBColorSpace; scene.background = bgTex; needs = true; };
      if (bg.type === 'picture' && bg.src) { const i = new Image(); i.onload = () => draw(i); i.src = bg.src; } else draw(null);
    } else scene.background = null;
    needs = true;
  }
  E.applyScene = () => { if (E.doc) applyScene(); };

  // ------------------------------------------------------------------ camera
  function applyCamera() { const v = views.find((x) => !x.ortho); if (!v || !E.doc) return; const c = E.doc.camera; v.cam.position.fromArray(c.pos); v.cam.fov = c.fov || 40; v.orbit.target.fromArray(c.target); v.orbit.update(); needs = true; }
  E.applyCamera = applyCamera;
  E.saveCamera = () => {
    if (E.camLock) return; const v = views.find((x) => !x.ortho); if (!v || !E.doc) return;
    // with a turntable or swing running, keep the camera's rest place (take the turn it has now back off)
    const tgt = v.orbit.target.clone(), off = v.cam.position.clone().sub(tgt).applyAxisAngle(new T.Vector3(0, 1, 0), -(E.camAngle || 0));
    E.doc.camera = { pos: tgt.clone().add(off).toArray().map((x) => +x.toFixed(3)), target: tgt.toArray().map((x) => +x.toFixed(3)), fov: v.cam.fov };
  };
  // Look at everything (or the selection) from the current direction
  E.fit = function (onlySelected) {
    const v = views.find((x) => !x.ortho); if (!v) return;
    const b = onlySelected && selected ? new T.Box3().setFromObject(selected) : sceneBox();
    const c = b.getCenter(new T.Vector3()), r = Math.max(0.5, b.getSize(new T.Vector3()).length() / 2);
    const dist = r / Math.sin(d2r(v.cam.fov) / 2) * 0.92, dir = v.cam.position.clone().sub(v.orbit.target).normalize();
    v.orbit.target.copy(c); v.cam.position.copy(c).addScaledVector(dir, dist); v.orbit.update();
    views.forEach((x) => { if (x.ortho) x.zoom = 1; }); needs = true;
  };
  // Standard views: front, back, left, right, top, bottom, three-quarter
  E.VIEWS = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001], three: [0.75, 0.55, 1] };
  E.viewFrom = function (name) {
    const v = views.find((x) => !x.ortho); if (!v) return;
    const dist = v.cam.position.distanceTo(v.orbit.target), dir = new T.Vector3(...E.VIEWS[name]).normalize();
    v.cam.position.copy(v.orbit.target).addScaledVector(dir, dist); v.cam.up.set(0, 1, 0); v.orbit.update(); needs = true; emit('view');
  };

  // ------------------------------------------------------------------ the corner rotator
  // A fixed X / Y / Z dial in the corner of the 3D view. Drag a ring to turn around that axis; drag the ball to turn freely.
  // It turns the whole scene (the camera goes round it) or only the selected object.
  E.rotateTarget = 'all';
  E.rotateBy = function (axis, angle) {
    const v = views.find((x) => !x.ortho); if (!v) return;
    const q = new T.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
    if (E.rotateTarget === 'selected' && selected) {
      const m = E.find(selected.userData.id); if (!m || m.locked) return;
      selected.quaternion.premultiply(q); selected.updateMatrixWorld(); syncFromObject(selected); emit('moving');
    } else {
      // turning the whole scene one way = turning the camera round it the other way
      const qi = q.clone().invert(), off = v.cam.position.clone().sub(v.orbit.target).applyQuaternion(qi);
      v.cam.position.copy(v.orbit.target).add(off); v.cam.up.applyQuaternion(qi); v.cam.lookAt(v.orbit.target); v.orbit.update(); emit('view');
    }
    needs = true;
  };
  E.rotateDone = () => { if (E.rotateTarget === 'selected' && selected) { syncFromObject(selected); emit('changed'); } else { E.saveCamera(); emit('camera'); } };
  E.cameraBasis = () => { const v = views.find((x) => !x.ortho); return v ? v.cam : null; };

  // ------------------------------------------------------------------ pictures of the scene
  // Render at any size; see-through when the background is off and transparent is asked for.
  E.renderImage = function (w, h, { transparent = false, grid: showGrid = false } = {}) {
    // drawn with the same renderer at the asked size (so materials and reflections stay as they are), then put back
    const v = views.find((x) => !x.ortho);
    const cam = v.cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix();
    const keepBg = scene.background, keepGrid = grid.visible, helpers = [], keepRatio = renderer.getPixelRatio(), keepSize = renderer.getSize(new T.Vector2());
    scene.traverse((x) => { if (x.userData.helper && x.visible) { helpers.push(x); x.visible = false; } });
    const floor = ground.getObjectByName('floor'), keepFloor = floor.visible;
    grid.visible = showGrid; if (transparent) { scene.background = null; floor.visible = false; } // see-through: shadows only, no floor
    const maxSize = renderer.capabilities.maxTextureSize || 4096, k = Math.min(1, maxSize / Math.max(w, h));
    renderer.setScissorTest(false); renderer.setPixelRatio(1); renderer.setSize(Math.round(w * k), Math.round(h * k), false);
    renderer.setViewport(0, 0, Math.round(w * k), Math.round(h * k)); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, cam);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(renderer.domElement, 0, 0, Math.round(w * k), Math.round(h * k), 0, 0, w, h);
    scene.background = keepBg; grid.visible = keepGrid; floor.visible = keepFloor; helpers.forEach((x) => (x.visible = true));
    renderer.setPixelRatio(keepRatio); renderer.setSize(keepSize.x, keepSize.y, false);
    needs = true;
    return out;
  };
  // ------------------------------------------------------------------ ray-traced render (path tracing, three-gpu-pathtracer)
  // Light bounces between surfaces like real light: soft shadows, true reflections, glass that bends light. It gets better
  // with every sample, so the window shows it clearing up. The editor pauses while it renders.
  E.QUALITY = { draft: ['Draft', 24, 3], good: ['Good', 96, 5], high: ['High', 320, 8], best: ['Best', 1000, 12] };
  E.pathRender = function (w, h, o = {}) {
    const v = views.find((x) => !x.ortho), cam = v.cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix();
    const [, samples, bounces] = E.QUALITY[o.quality] || E.QUALITY.good;
    E.busy = true; tc.detach();
    const keep = { bg: scene.background, env: scene.environment, envI: scene.environmentIntensity, grid: grid.visible, ratio: renderer.getPixelRatio(), size: renderer.getSize(new T.Vector2()), helpers: [] };
    scene.traverse((x) => { if (x.userData.helper && x.visible) { keep.helpers.push(x); x.visible = false; } }); grid.visible = false;
    const floor = ground.getObjectByName('floor'), shadow = ground.getObjectByName('shadow'); keep.floor = floor.visible; keep.shadowMat = shadow.material;
    if (o.transparent) { scene.background = null; floor.visible = false; }
    const matte = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }); matte.matte = true; shadow.material = matte; // shadows only
    keep.shadowVis = shadow.visible; if (floor.visible && ground.visible) shadow.visible = false; // with a floor, the floor itself catches the shadows
    // the same studio room the editor uses, as an environment the path tracer can sample
    const cubeRT = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType }), cubeCam = new T.CubeCamera(0.1, 100, cubeRT), room = new T.RoomEnvironment();
    cubeCam.update(renderer, room); scene.environment = cubeRT.texture; scene.environmentIntensity = 0.8 * ((E.doc && E.doc.scene.reflect) ?? 1);
    const k = Math.min(1, Math.min(8192, renderer.capabilities.maxTextureSize || 4096) / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k);
    renderer.setScissorTest(false); renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setViewport(0, 0, W, H);
    const pt = new T.WebGLPathTracer(renderer), tiles = W * H > 2e6 ? 3 : 2;
    Object.assign(pt, { renderDelay: 0, minSamples: 0, fadeDuration: 0, bounces, transmissiveBounces: 10, filterGlossyFactor: 0.5, renderScale: 1, dynamicLowRes: false, rasterizeScene: false });
    pt.tiles.set(tiles, tiles);
    pt.setScene(scene, cam);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const ox = out.getContext('2d');
    const copy = () => { ox.clearRect(0, 0, w, h); ox.drawImage(renderer.domElement, 0, 0, W, H, 0, 0, w, h); };
    let stopped = false, frame = 0;
    const finish = () => {
      pt.dispose(); cubeRT.dispose(); matte.dispose();
      shadow.material = keep.shadowMat; shadow.visible = keep.shadowVis; floor.visible = keep.floor; scene.background = keep.bg; scene.environment = keep.env; scene.environmentIntensity = keep.envI;
      grid.visible = keep.grid; keep.helpers.forEach((x) => (x.visible = true));
      renderer.setPixelRatio(keep.ratio); renderer.setSize(keep.size.x, keep.size.y, false);
      E.busy = false; if (selected) tc.attach(selected); needs = true;
    };
    const step = () => {
      if (stopped) return;
      for (let i = 0; i < tiles * tiles; i++) pt.renderSample();
      const n = Math.floor(pt.samples); frame++;
      if (n >= samples) { copy(); stopped = true; finish(); o.onDone && o.onDone(out, n, false); return; }
      if (frame % 3 === 0) { copy(); o.onProgress && o.onProgress(out, n, samples); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return { canvas: out, samples, stop: () => { if (stopped) return; stopped = true; copy(); const n = Math.floor(pt.samples); finish(); o.onDone && o.onDone(out, n, true); } };
  };
  E.thumbnail = (w = 320, h = 200) => E.renderImage(w, h, {}).toDataURL('image/jpeg', 0.8);

  // ------------------------------------------------------------------ 3D files
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  E.b64 = b64;
  // A model brought in from a file keeps the file inside the scene (so the scene opens anywhere)
  async function loadModel(m) {
    const buf = unb64(m.model.data), fmt = m.model.format;
    let o;
    if (fmt === 'glb' || fmt === 'gltf') o = (await new T.GLTFLoader().parseAsync(fmt === 'gltf' ? new TextDecoder().decode(buf) : buf, '')).scene;
    else if (fmt === 'obj') { o = new T.OBJLoader().parse(new TextDecoder().decode(buf)); o.traverse((x) => { if (x.isMesh) x.material = materialsFor(m.mat, null); }); }
    else if (fmt === 'stl') { const g = new T.STLLoader().parse(buf); g.computeVertexNormals(); o = new T.Mesh(g, materialsFor(m.mat, null)); }
    if (m.model.keepOwn === false && fmt !== 'stl' && fmt !== 'obj') o.traverse((x) => { if (x.isMesh) x.material = materialsFor(m.mat, null); });
    // make it a sensible size, standing on the ground, centred
    const inner = new T.Group(); inner.add(o);
    const b = new T.Box3().setFromObject(o), size = b.getSize(new T.Vector3()), k = m.model.fit ? m.model.fit / Math.max(size.x, size.y, size.z, 1e-6) : 1;
    o.scale.multiplyScalar(k); const c = b.getCenter(new T.Vector3()).multiplyScalar(k); o.position.sub(c);
    const g = new T.Group(); g.add(inner); return g;
  }
  E.importFile = async function (file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['glb', 'gltf', 'obj', 'stl'].includes(ext)) throw new Error('3DCraft opens GLB, GLTF, OBJ and STL files.');
    const buf = await file.arrayBuffer();
    return { kind: 'model', name: file.name.replace(/\.[^.]+$/, ''), model: { format: ext, data: b64(buf), fit: 3, keepOwn: ext === 'glb' || ext === 'gltf' } };
  };
  // Export the objects (not the ground or helpers) as GLB, OBJ or STL
  E.exportModel = async function (fmt, onlySelected) {
    const src = onlySelected && selected ? selected : root;
    const tmp = src.clone(true); tmp.updateMatrixWorld(true);
    if (fmt === 'glb') { const r = await new T.GLTFExporter().parseAsync(tmp, { binary: true }); return new Blob([r], { type: 'model/gltf-binary' }); }
    if (fmt === 'obj') return new Blob([new T.OBJExporter().parse(tmp)], { type: 'text/plain' });
    if (fmt === 'stl') return new Blob([new T.STLExporter().parse(tmp, { binary: true })], { type: 'model/stl' });
    throw new Error('Unknown format');
  };
  // ------------------------------------------------------------------ animation
  // doc.anim = { length (s), fps, loop, tracks: { id: { start, end, keys: { pos|rot|scale|color|opacity: [{ t, v, ease }] } } }, camera: { move, amount } }
  // A property with keyframes follows them; without, it stays at the object's own value (its rest pose).
  E.ANIM_PROPS = { pos: 'Position', rot: 'Turn', scale: 'Size', color: 'Colour', opacity: 'Opacity' };
  E.EASES = { linear: 'Linear', ease: 'Ease (in and out)', in: 'Ease in (speed up)', out: 'Ease out (slow down)', hold: 'Hold (jump)', bounce: 'Bounce' };
  const bounceOut = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
  const EASE = { linear: (x) => x, ease: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2), in: (x) => x * x * x, out: (x) => 1 - (1 - x) ** 3, hold: () => 0, bounce: bounceOut };
  E.anim = () => { if (!E.doc) return null; if (!E.doc.anim) E.doc.anim = { length: 5, fps: 30, loop: true, tracks: {}, camera: { move: 'none', amount: 360 } }; return E.doc.anim; };
  E.track = (id, make) => { const a = E.anim(); if (!a.tracks[id] && make) a.tracks[id] = { keys: {} }; return a.tracks[id]; };
  E.time = 0;
  const baseOf = (m, prop) => (prop === 'color' ? m.mat && m.mat.color : prop === 'opacity' ? (m.mat ? m.mat.opacity ?? 1 : 1) : m[prop]);
  function lerp(a, b, u) {
    if (Array.isArray(a)) return a.map((x, i) => x + (b[i] - x) * u);
    if (typeof a === 'string') return '#' + new T.Color(a).lerp(new T.Color(b), u).getHexString();
    return a + (b - a) * u;
  }
  E.valueAt = function (m, prop, t) {
    const tr = E.anim() && E.anim().tracks[m.id], keys = tr && tr.keys[prop];
    if (!keys || !keys.length) return baseOf(m, prop);
    if (t <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1]; if (t >= last.t) return last.v;
    let i = 0; while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const k0 = keys[i], k1 = keys[i + 1], u = (t - k0.t) / Math.max(1e-6, k1.t - k0.t);
    return lerp(k0.v, k1.v, (EASE[k0.ease || 'ease'] || EASE.ease)(Math.max(0, Math.min(1, u))));
  };
  E.isAnimated = (m, prop) => { const tr = E.anim() && E.anim().tracks[m.id]; return !!(tr && tr.keys[prop] && tr.keys[prop].length); };
  // set a key (replacing one within half a frame)
  E.setKey = function (m, prop, t, v, ease) {
    const tr = E.track(m.id, true), keys = (tr.keys[prop] = tr.keys[prop] || []), half = 0.5 / (E.anim().fps || 30);
    const old = keys.find((k) => Math.abs(k.t - t) < half);
    if (old) { old.v = v; if (ease) old.ease = ease; } else keys.push({ t: +t.toFixed(4), v, ease: ease || 'ease' });
    keys.sort((a, b) => a.t - b.t);
  };
  E.removeKey = (m, prop, k) => { const tr = E.track(m.id); if (!tr || !tr.keys[prop]) return; tr.keys[prop] = tr.keys[prop].filter((x) => x !== k); if (!tr.keys[prop].length) delete tr.keys[prop]; };
  // Change a value: animated properties get a key at the current time, others change the rest pose
  E.setValue = function (m, prop, v) {
    if (E.isAnimated(m, prop)) E.setKey(m, prop, E.time, v);
    else if (prop === 'color') m.mat.color = v; else if (prop === 'opacity') m.mat.opacity = v; else m[prop] = v;
  };
  // Show the scene as it is at time t (seconds)
  E.evalAt = function (t) {
    const a = E.anim(); if (!a) return;
    E.time = Math.max(0, Math.min(a.length, t));
    const tt = E.time;
    E.doc.objects.forEach((m) => {
      const o = built.get(m.id); if (!o) return;
      const tr = a.tracks[m.id];
      o.position.fromArray(E.valueAt(m, 'pos', tt)); o.rotation.set(...E.valueAt(m, 'rot', tt).map(d2r)); o.scale.fromArray(E.valueAt(m, 'scale', tt));
      const on = m.visible !== false && (!tr || ((tr.start ?? 0) <= tt + 1e-6 && tt <= (tr.end ?? a.length) + 1e-6));
      o.visible = on;
      if (m.kind !== 'group' && m.mat && tr && (tr.keys.color || tr.keys.opacity)) {
        const col = E.valueAt(m, 'color', tt), op = E.valueAt(m, 'opacity', tt);
        o.traverse((x) => { if (!x.isMesh) return; [].concat(x.material).forEach((mt) => { if (!mt.map && tr.keys.color && !(m.kind === 'trace' && m.trace.ownColours !== false)) mt.color.set(col); mt.opacity = op; mt.transparent = op < 1 || mt.transmission > 0; if (m.mat.glow && tr.keys.color) mt.emissive.set(col); }); });
      }
      if (o.userData.letters) poseLetters(m, o, tr, tt, E.valueAt(m, 'opacity', tt));
    });
    // the camera: a turntable all the way round, or a swing to and fro
    const v = views.find((x) => !x.ortho), cm = a.camera || {};
    if (v && E.doc.camera) {
      const base = E.doc.camera, tgt = new T.Vector3().fromArray(base.target), off = new T.Vector3().fromArray(base.pos).sub(tgt);
      const u = tt / Math.max(0.001, a.length), ang = cm.move === 'turntable' ? d2r(cm.amount ?? 360) * u : cm.move === 'swing' ? d2r((cm.amount ?? 60) / 2) * Math.sin(u * Math.PI * 2) : 0;
      E.camAngle = cm.move && cm.move !== 'none' ? ang : 0;
      if (cm.move && cm.move !== 'none') { E.camLock = true; off.applyAxisAngle(new T.Vector3(0, 1, 0), ang); v.cam.position.copy(tgt).add(off); v.orbit.target.copy(tgt); v.orbit.update(); E.camLock = false; }
    }
    needs = true; emit('time', tt);
  };
  // Frames for export: the renderer is set to the frame size once, then each frame is drawn at its time
  E.beginFrames = function (w, h, { transparent = false } = {}) {
    E.busy = true; tc.detach();
    const keep = { bg: scene.background, grid: grid.visible, ratio: renderer.getPixelRatio(), size: renderer.getSize(new T.Vector2()), helpers: [], time: E.time };
    scene.traverse((x) => { if (x.userData.helper && x.visible) { keep.helpers.push(x); x.visible = false; } });
    grid.visible = false; const floor = ground.getObjectByName('floor'); keep.floor = floor.visible;
    if (transparent) { scene.background = null; floor.visible = false; }
    renderer.setScissorTest(false); renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.setViewport(0, 0, w, h);
    const v = views.find((x) => !x.ortho);
    return {
      canvas: renderer.domElement,
      frame(t) { E.evalAt(t); const cam = v.cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); return renderer.domElement; },
      end() { scene.background = keep.bg; grid.visible = keep.grid; floor.visible = keep.floor; keep.helpers.forEach((x) => (x.visible = true)); renderer.setPixelRatio(keep.ratio); renderer.setSize(keep.size.x, keep.size.y, false); E.busy = false; E.evalAt(keep.time); if (selected) tc.attach(selected); needs = true; },
    };
  };
  E.renderer = () => renderer; E.scene = () => scene; E.root = () => root;
})();
