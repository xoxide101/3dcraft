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
    plastic: ['Plastic', { metal: 0, rough: 0.32, coat: 0, glass: 0, glow: 0, spec: 0.7 }],
    gloss: ['Glossy paint', { metal: 0, rough: 0.25, coat: 1, glass: 0, glow: 0, spec: 1 }],
    matte: ['Matte', { metal: 0, rough: 1, coat: 0, glass: 0, glow: 0, spec: 0.15 }],
    gold: ['Gold', { color: '#e6b422', metal: 1, rough: 0.22, coat: 0, glass: 0, glow: 0 }],
    silver: ['Silver', { color: '#d8dade', metal: 1, rough: 0.18, coat: 0, glass: 0, glow: 0 }],
    chrome: ['Chrome', { color: '#ffffff', metal: 1, rough: 0.04, coat: 0, glass: 0, glow: 0 }],
    copper: ['Copper', { color: '#c8703f', metal: 1, rough: 0.28, coat: 0, glass: 0, glow: 0 }],
    glass: ['Glass', { color: '#ffffff', metal: 0, rough: 0.03, coat: 0, glass: 1, glow: 0 }],
    glow: ['Glow', { metal: 0, rough: 0.6, coat: 0, glass: 0, glow: 1.6 }],
    water: ['Water', { color: '#3d8fd1', metal: 0, rough: 0.03, coat: 0, glass: 0.92, glow: 0, spec: 1, ior: 1.33, waves: 1 }],
    rubber: ['Rubber', { metal: 0, rough: 0.6, coat: 0, glass: 0, glow: 0, spec: 0.25, sheen: 1 }],
  };
  E.defaultMat = (color = '#3f7fe0', preset = 'plastic') => ({ preset, color, ...E.MATERIALS[preset][1], ...(E.MATERIALS[preset][1].color ? {} : { color }), opacity: 1, faces: {} });

  // Shapes: [name, defaults]. Sizes are in scene units (about 1 unit = 10 cm).
  E.SHAPES = {
    box: ['Box', { w: 2, h: 2, d: 2 }], roundbox: ['Rounded box', { w: 2, h: 2, d: 2, round: 0.25 }], sphere: ['Sphere', { r: 1.2 }],
    cylinder: ['Cylinder', { r: 1, h: 2 }], cone: ['Cone', { r: 1.1, h: 2.2 }], pyramid: ['Pyramid', { r: 1.4, h: 2 }], prism: ['Prism', { r: 1, h: 2, sides: 6 }],
    torus: ['Ring (doughnut)', { r: 1.1, tube: 0.4 }], washer: ['Flat ring', { r: 1.3, hole: 0.7, d: 0.4 }], capsule: ['Capsule', { r: 0.7, h: 1.6 }],
    star: ['Star', { r: 1.4, inner: 0.55, points: 5, d: 0.5 }], heart: ['Heart', { r: 1.4, d: 0.5 }], plane: ['Flat panel', { w: 3, h: 2 }],
    // a stage to stand things on: form, width, depth, height of each step, corner and edge roundness, steps and how far each step comes in
    stage: ['Stage', { form: 'round', w: 6, d: 4, h: 0.4, corner: 0.3, edge: 0.06, steps: 1, stepIn: 0.5 }],
  };
  E.STAGE_FORMS = { round: 'Round', oval: 'Oval', square: 'Square', rect: 'Rectangle', hex: 'Hexagon', oct: 'Octagon' };
  // Objects: made of named parts (each part is a face with its own colour, picture or pattern). [name, defaults, fields]
  // fields: [key, label, min, max, step] for numbers, or [key, label, { value: name }] for a choice.
  Object.assign(E.SHAPES, {
    palm: ['Palm tree', { h: 7, lean: 0.3, leaves: 8, nuts: 3 }, [['h', 'Height', 2, 30, 0.5], ['lean', 'Lean', 0, 1, 0.05], ['leaves', 'Leaves', 3, 14, 1], ['nuts', 'Coconuts', 0, 8, 1]]],
    table: ['Table', { top: 'round', base: 'pedestal', w: 4, d: 2.6, h: 3, thick: 0.15 }, [['top', 'Top', { round: 'Round', square: 'Square', rect: 'Rectangle' }], ['base', 'Legs', { pedestal: 'One leg, feet to 4 sides', legs: '4 legs' }], ['w', 'Width', 1, 20, 0.1], ['d', 'Depth (rectangle)', 0.5, 20, 0.1], ['h', 'Height', 0.5, 10, 0.1], ['thick', 'Top thickness', 0.03, 1, 0.01]]],
    monitor: ['Computer monitor', { size: 24 }, [['size', 'Size (inches)', 10, 60, 1]]],
    tv: ['Flat TV', { size: 43 }, [['size', 'Size (inches)', 19, 100, 1]]],
    crt: ['CRT TV', { size: 20 }, [['size', 'Size (inches)', 9, 36, 1]]],
    boat: ['Test boat', { size: 1 }, [['size', 'Size', 0.2, 5, 0.1]]],
    // scenery objects that go with the backdrops
    rock: ['Rock', { size: 1, seed: 7 }, [['size', 'Size', 0.2, 5, 0.05], ['seed', 'Shape (try another number)', 1, 999, 1]]],
    asteroid: ['Asteroid', { size: 1, seed: 3 }, [['size', 'Size', 0.2, 5, 0.05], ['seed', 'Shape (try another number)', 1, 999, 1]]],
    crater: ['Crater', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    rocket: ['Rocket', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    ufo: ['Flying saucer', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    sailboat: ['Sailboat', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    lighthouse: ['Lighthouse', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    umbrella: ['Beach umbrella', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    chip: ['Microchip', { size: 1, pins: 8 }, [['size', 'Size', 0.2, 5, 0.05], ['pins', 'Pins on each side', 2, 20, 1]]],
    capacitor: ['Capacitor', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    streetlamp: ['Street lamp', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    bench: ['Bench', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    trafficcone: ['Traffic cone', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    pine3d: ['Pine tree', { size: 1, tiers: 4 }, [['size', 'Size', 0.2, 5, 0.05], ['tiers', 'Tiers', 2, 8, 1]]],
    stump: ['Tree stump', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    mushroom: ['Mushroom', { size: 1 }, [['size', 'Size', 0.2, 5, 0.05]]],
    cactus: ['Cactus', { size: 1, seed: 5 }, [['size', 'Size', 0.2, 5, 0.05], ['seed', 'Shape (try another number)', 1, 999, 1]]],
    bush: ['Bush', { size: 1, seed: 11 }, [['size', 'Size', 0.2, 5, 0.05], ['seed', 'Shape (try another number)', 1, 999, 1]]],
    fence: ['Fence', { size: 1, posts: 5 }, [['size', 'Size', 0.2, 5, 0.05], ['posts', 'Posts', 2, 20, 1]]],
  });
  // the parts' own colours to start with (the object's Colour is used for any part without one)
  E.PART_COLOURS = {
    palm: { trunk: { type: 'solid', color: '#8a5a33' }, leaves: { type: 'solid', color: '#2f9e44' }, coconuts: { type: 'solid', color: '#5c3b1e' } },
    table: { top: { type: 'solid', color: '#b07a4a' }, legs: { type: 'solid', color: '#3b3b3b' } },
    monitor: { body: { type: 'solid', color: '#22252b' }, screen: { type: 'solid', color: '#0b0e13' } },
    tv: { body: { type: 'solid', color: '#16181c' }, screen: { type: 'solid', color: '#0b0e13' } },
    crt: { body: { type: 'solid', color: '#d9d4c7' }, screen: { type: 'solid', color: '#1d2a24' } },
    rock: { rock: { type: 'solid', color: '#8c8f94' } },
    asteroid: { rock: { type: 'solid', color: '#6e6258' } },
    crater: { rim: { type: 'solid', color: '#8a8c91' }, floor: { type: 'solid', color: '#4a4c52' } },
    rocket: { body: { type: 'solid', color: '#f1f3f5' }, fins: { type: 'solid', color: '#e03131' }, window: { type: 'solid', color: '#4dabf7' } },
    ufo: { hull: { type: 'solid', color: '#adb5bd' }, dome: { type: 'solid', color: '#a5d8ff' }, lights: { type: 'solid', color: '#ffe066' } },
    sailboat: { hull: { type: 'solid', color: '#f8f9fa' }, mast: { type: 'solid', color: '#8a5a33' }, sails: { type: 'solid', color: '#efd9a8' } },
    lighthouse: { tower: { type: 'solid', color: '#f8f9fa' }, stripes: { type: 'solid', color: '#e03131' }, lantern: { type: 'solid', color: '#ffe066' }, roof: { type: 'solid', color: '#343a40' } },
    umbrella: { canopy: { type: 'solid', color: '#e03131' }, stripes: { type: 'solid', color: '#f8f9fa' }, pole: { type: 'solid', color: '#ced4da' } },
    chip: { body: { type: 'solid', color: '#1f2328' }, pins: { type: 'solid', color: '#ced4da' }, mark: { type: 'solid', color: '#868e96' } },
    capacitor: { body: { type: 'solid', color: '#1c7ed6' }, stripe: { type: 'solid', color: '#e7f5ff' }, metal: { type: 'solid', color: '#ced4da' } },
    streetlamp: { pole: { type: 'solid', color: '#343a40' }, lamp: { type: 'solid', color: '#fff3bf' } },
    bench: { wood: { type: 'solid', color: '#a0673a' }, metal: { type: 'solid', color: '#2b2f33' } },
    trafficcone: { cone: { type: 'solid', color: '#ff6b1a' }, stripes: { type: 'solid', color: '#f8f9fa' }, base: { type: 'solid', color: '#212529' } },
    pine3d: { trunk: { type: 'solid', color: '#6b4a2e' }, needles: { type: 'solid', color: '#2b7a3d' } },
    stump: { bark: { type: 'solid', color: '#6b4a2e' }, wood: { type: 'solid', color: '#d8b483' } },
    mushroom: { stem: { type: 'solid', color: '#f1e9da' }, cap: { type: 'solid', color: '#e03131' }, spots: { type: 'solid', color: '#ffffff' } },
    cactus: { cactus: { type: 'solid', color: '#3f8a4a' }, flower: { type: 'solid', color: '#f783ac' } },
    bush: { leaves: { type: 'solid', color: '#3f8a4a' } },
    fence: { wood: { type: 'solid', color: '#c99a6b' } },
    boat: { hull: { type: 'solid', color: '#1971c2' }, cabin: { type: 'solid', color: '#f8f9fa' }, windows: { type: 'solid', color: '#1b2430' }, chimney: { type: 'solid', color: '#e03131' } },
  };
  E.isObjectShape = (type) => !!(E.SHAPES[type] && E.SHAPES[type][2]);

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
  const SLOTS = { box: ['sides', 'sides', 'top', 'bottom', 'front', 'back'], cyl: ['sides', 'top', 'bottom'], extrude: ['front', 'back', 'sides'], stage: ['top', 'bottom', 'sides'] };
  // The outline of a stage seen from above (w across, d deep), with its corners rounded by `corner` (0 sharp to 1 fully round)
  function stageOutline(form, w, d, corner) {
    const sh = new T.Shape();
    if (form === 'round' || form === 'oval') { sh.absellipse(0, 0, w / 2, (form === 'round' ? w : d) / 2, 0, Math.PI * 2, false); return sh; }
    let pts;
    if (form === 'hex' || form === 'oct') { const n = form === 'hex' ? 6 : 8; pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + Math.PI / n; return [Math.cos(a) * w / 2, Math.sin(a) * w / 2]; }); }
    else { const dd = form === 'square' ? w : d; pts = [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]]; }
    // round each corner: cut in along both sides, then curve across
    const n = pts.length, side = Math.min(...pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1])));
    const r = Math.max(0, Math.min(1, corner || 0)) * side / 2;
    pts.forEach((p, i) => {
      const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
      const toward = (q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [p[0] + (dx / L) * r, p[1] + (dy / L) * r]; };
      const a = toward(prev), b = toward(next);
      if (i === 0) sh.moveTo(a[0], a[1]); else sh.lineTo(a[0], a[1]);
      if (r > 1e-4) sh.quadraticCurveTo(p[0], p[1], b[0], b[1]); else sh.lineTo(p[0], p[1]);
    });
    sh.closePath();
    return sh;
  }
  // A stage: one slab per step, each smaller by stepIn on every side, stacked; faces are top, bottom and sides
  function stageGeo(p) {
    const steps = Math.max(1, Math.min(6, p.steps | 0 || 1)), h = Math.max(0.02, p.h || 0.4), parts = [];
    for (let i = 0; i < steps; i++) {
      const inset = i * (p.stepIn ?? 0.5) * 2, w = Math.max(0.1, p.w - inset), d = Math.max(0.1, (p.d || p.w) - inset);
      const edge = Math.max(0, Math.min(p.edge || 0, h / 2 - 0.005, Math.min(w, d) / 4)), grow = edge * 0.8;
      // the rounded rim grows the outline outwards: start that much smaller so the size stays as typed
      const sh = stageOutline(p.form, Math.max(0.05, w - grow * 2), Math.max(0.05, d - grow * 2), p.corner);
      const g = extrudeShapes([sh], Math.max(0.01, h - edge * 2), edge, 24);
      g.rotateX(-Math.PI / 2); g.translate(0, h / 2 + i * h, 0); parts.push(g);
    }
    // join the steps, keeping all tops together, then all bottoms, then all sides (three face groups)
    const total = steps * h, out = new T.BufferGeometry(), names = ['position', 'normal', 'uv'], arrays = names.map(() => []), groups = [];
    for (let k = 0; k < 3; k++) {
      const start = arrays[0].length / 3;
      parts.forEach((g) => { const gr = g.groups[k]; names.forEach((nm, j) => { const at = g.attributes[nm], s = at.itemSize; arrays[j].push(...at.array.slice(gr.start * s, (gr.start + gr.count) * s)); }); });
      groups.push([start, arrays[0].length / 3 - start]);
    }
    names.forEach((nm, j) => out.setAttribute(nm, new T.Float32BufferAttribute(arrays[j], j === 2 ? 2 : 3)));
    groups.forEach(([s, c], k) => out.addGroup(s, c, k));
    out.translate(0, -total / 2, 0);
    parts.forEach((g) => g.dispose());
    return out;
  }
  // ------------------------------------------------------------------ objects made of parts
  const BGU = () => T.BufferGeometryUtils;
  // place a geometry: move, turn (radians) and size it
  const put = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz)));
  // parts: [[name, [geometries]], …] → one geometry with a group per part, and the part names (the faces)
  function partsGeo(parts) {
    const names = [], merged = [];
    parts.forEach(([name, geos]) => {
      const list = geos.filter(Boolean).map((g) => {
        const n = g.index ? g.toNonIndexed() : g, out = new T.BufferGeometry();
        if (!n.attributes.normal) n.computeVertexNormals();
        out.setAttribute('position', n.attributes.position); out.setAttribute('normal', n.attributes.normal);
        out.setAttribute('uv', n.attributes.uv || new T.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
        return out;
      });
      if (list.length) { names.push(name); merged.push(BGU().mergeGeometries(list, false)); }
    });
    const geo = BGU().mergeGeometries(merged, true); geo.center();
    return [geo, names];
  }
  const rnd2 = (i, k) => { let h = (i + 1) * 2654435761 + k * 40503; h = (h ^ (h >>> 15)) * 2246822519; return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
  // a flat leaf along a path: both sides, a fold down the middle, saw-tooth edges like a palm frond
  function frond(pts, width) {
    const pos = [], nor = [], uv = [], n = pts.length;
    const up = new T.Vector3(0, 1, 0);
    const rows = pts.map((c, i) => {
      const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(), side = new T.Vector3().crossVectors(t, up).normalize();
      const s = i / (n - 1), w = width * Math.sin(Math.PI * Math.min(1, s * 1.15)) * (0.7 + 0.3 * Math.abs(Math.sin(s * Math.PI * 16)));
      const drop = new T.Vector3(0, -w * 0.3, 0);
      return [c.clone().addScaledVector(side, -w).add(drop), c.clone(), c.clone().addScaledVector(side, w).add(drop)];
    });
    const tri = (a, b, c) => { const nn = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(c, a)).normalize(); [a, b, c].forEach((p) => { pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uv.push(0, 0); }); };
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < 2; j++) {
      const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1];
      tri(a, c, b); tri(b, c, d); tri(a, b, c); tri(b, d, c); // both sides
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return g;
  }
  function palmGeo(p) {
    const H = p.h || 7, lean = p.lean ?? 0.3, segs = 16, trunk = [], leaves = [], nuts = [];
    const at = (t) => new T.Vector3(lean * H * 0.35 * t * t, H * t, 0);
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, a = at(t0), b = at(t1), len = a.distanceTo(b), r0 = 0.06 * H * (1 - 0.45 * t0), r1 = 0.06 * H * (1 - 0.45 * t1);
      // each ring a little wider at its bottom, like a palm's bark
      const g = new T.CylinderGeometry(r1 * 0.92, r0 * 1.06, len * 1.04, 12, 1);
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()), mid = a.clone().add(b).multiplyScalar(0.5);
      g.applyMatrix4(new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1))); trunk.push(g);
    }
    const top = at(1), L = H * 0.5, n = Math.max(3, p.leaves | 0 || 8);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd2(k, 1) * 0.4, dir = new T.Vector3(Math.cos(a), 0, Math.sin(a)), len = L * (0.8 + 0.35 * rnd2(k, 2)), rise = 0.3 + 0.25 * rnd2(k, 3);
      const pts = Array.from({ length: 22 }, (_, i) => { const s = i / 21; return top.clone().addScaledVector(dir, len * s).add(new T.Vector3(0, len * (rise * s - 0.85 * s * s), 0)); });
      leaves.push(frond(pts, len * 0.13));
    }
    for (let k = 0; k < (p.nuts | 0); k++) { const a = (k / Math.max(1, p.nuts)) * Math.PI * 2 + 0.5; nuts.push(put(new T.SphereGeometry(H * 0.032, 14, 10), top.x + Math.cos(a) * H * 0.045, top.y - H * 0.04, top.z + Math.sin(a) * H * 0.045)); }
    return partsGeo([['trunk', trunk], ['leaves', leaves], ['coconuts', nuts]]);
  }
  function tableGeo(p) {
    const w = p.w || 4, d = p.top === 'rect' ? p.d || w * 0.65 : w, h = p.h || 3, th = Math.min(p.thick || 0.15, h * 0.5), legs = [];
    const top = p.top === 'round' ? new T.CylinderGeometry(w / 2, w / 2, th, 64) : new T.RoundedBoxGeometry(w, th, d, 2, Math.min(0.04, th / 3));
    put(top, 0, h - th / 2, 0);
    if (p.base === 'legs') {
      const lw = Math.max(0.08, Math.min(w, d) * 0.05), inset = lw * 1.3;
      const spots = p.top === 'round' ? [45, 135, 225, 315].map((deg) => { const r = w / 2 * 0.72; return [Math.cos(deg * Math.PI / 180) * r, Math.sin(deg * Math.PI / 180) * r]; }) : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - inset), sz * (d / 2 - inset)]);
      spots.forEach(([x, z]) => legs.push(put(new T.BoxGeometry(lw, h - th, lw), x, (h - th) / 2, z)));
    } else {
      // one leg in the middle with feet out to the four sides
      const col = Math.max(0.08, Math.min(w, d) * 0.045), foot = 0.12;
      legs.push(put(new T.CylinderGeometry(col, col * 1.25, h - th, 24), 0, (h - th) / 2, 0));
      [[w / 2 * 0.72, 0], [0, d / 2 * 0.72]].forEach(([lx, lz], i) => {
        const len = Math.max(lx, lz) * 2;
        legs.push(put(new T.BoxGeometry(i ? col * 1.6 : len, foot, i ? len : col * 1.6), 0, foot / 2, 0));
      });
      legs.push(put(new T.CylinderGeometry(col * 2.2, col * 2.2, foot * 1.2, 24), 0, foot * 0.6, 0));
    }
    return partsGeo([['top', [top]], ['legs', legs]]);
  }
  // a flat screen (monitor or TV): thin body with a narrow edge round the screen; the screen is its own part
  function flatScreenGeo(W, H, depth, bezel, standH, kind) {
    const body = [], screen = new T.PlaneGeometry(W, H);
    const cy = standH + (H + bezel * 2) / 2;
    body.push(put(new T.RoundedBoxGeometry(W + bezel * 2, H + bezel * 2, depth, 2, Math.min(0.03, depth / 3)), 0, cy, 0));
    put(screen, 0, cy, depth / 2 + 0.003);
    if (kind === 'monitor') {
      body.push(put(new T.BoxGeometry(W * 0.08, standH + H * 0.3, 0.08), 0, (standH + H * 0.3) / 2, -depth / 2 - 0.05));
      body.push(put(new T.RoundedBoxGeometry(W * 0.4, 0.05, W * 0.24, 2, 0.02), 0, 0.025, -depth / 2 - 0.05));
    } else {
      [-1, 1].forEach((sx) => body.push(put(new T.BoxGeometry(W * 0.03, standH + 0.1, W * 0.12), sx * W * 0.38, (standH + 0.1) / 2, 0)));
    }
    return partsGeo([['body', body], ['screen', [screen]]]);
  }
  function crtGeo(p) {
    const W = (p.size || 20) * 0.16, H = W * 0.75, fw = W * 1.22, fh = H * 1.32, D = W * 1.05, body = [];
    body.push(put(new T.RoundedBoxGeometry(fw, fh, D * 0.32, 3, Math.min(0.12, fw * 0.03)), 0, fh / 2, D / 2 - D * 0.16));
    // the back tapers in, like the tube inside
    const back = new T.BoxGeometry(fw * 0.96, fh * 0.94, D * 0.7, 1, 1, 1), bp = back.attributes.position;
    for (let i = 0; i < bp.count; i++) if (bp.getZ(i) < 0) { bp.setX(i, bp.getX(i) * 0.55); bp.setY(i, bp.getY(i) * 0.6); }
    back.computeVertexNormals(); body.push(put(back, 0, fh / 2 * 0.98, D / 2 - D * 0.32 - D * 0.35));
    // two knobs under the screen
    [0, 1].forEach((i) => body.push(put(new T.CylinderGeometry(fw * 0.025, fw * 0.025, 0.06, 16), fw * (0.3 + i * 0.08), fh * 0.09, D / 2 + 0.02, Math.PI / 2)));
    // the glass bulges out a little
    const sc = new T.PlaneGeometry(W, H, 16, 12), sp = sc.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / (W / 2), y = sp.getY(i) / (H / 2); sp.setZ(i, (1 - x * x * 0.6) * (1 - y * y * 0.6) * W * 0.03); }
    sc.computeVertexNormals(); put(sc, 0, fh * 0.55, D / 2 + 0.005);
    return partsGeo([['body', body], ['screen', [sc]]]);
  }
  // an original little test boat (a tug): hull, cabin with windows, roof and a chimney
  function boatGeo(p) {
    const k = p.size || 1, L = 2.6 * k, B = 1.1 * k, hullH = 0.5 * k;
    const sh = new T.Shape(); sh.moveTo(-L / 2, -B / 2); sh.lineTo(L * 0.12, -B / 2); sh.quadraticCurveTo(L / 2, -B * 0.32, L / 2, 0); sh.quadraticCurveTo(L / 2, B * 0.32, L * 0.12, B / 2); sh.lineTo(-L / 2, B / 2); sh.closePath();
    const hull = new T.ExtrudeGeometry(sh, { depth: hullH, bevelEnabled: true, bevelThickness: 0.04 * k, bevelSize: 0.04 * k, bevelSegments: 3, curveSegments: 24 });
    hull.rotateX(-Math.PI / 2);
    // narrower at the waterline than at the deck
    const hp = hull.attributes.position; for (let i = 0; i < hp.count; i++) { const t = Math.max(0, Math.min(1, hp.getY(i) / hullH)); hp.setZ(i, hp.getZ(i) * (0.72 + 0.28 * t)); hp.setX(i, hp.getX(i) * (0.92 + 0.08 * t)); }
    hull.computeVertexNormals();
    const cabin = [put(new T.RoundedBoxGeometry(0.9 * k, 0.55 * k, 0.78 * B, 2, 0.04 * k), -0.12 * k, hullH + 0.3 * k, 0), put(new T.RoundedBoxGeometry(1.08 * k, 0.07 * k, 0.92 * B, 2, 0.02 * k), -0.12 * k, hullH + 0.6 * k, 0), put(new T.RoundedBoxGeometry(0.5 * k, 0.36 * k, 0.6 * B, 2, 0.03 * k), -0.25 * k, hullH + 0.82 * k, 0), put(new T.RoundedBoxGeometry(0.62 * k, 0.05 * k, 0.7 * B, 2, 0.015 * k), -0.25 * k, hullH + 1.02 * k, 0)];
    const windows = [];
    [-1, 1].forEach((sz) => [-0.4, -0.1, 0.18].forEach((x) => windows.push(put(new T.CylinderGeometry(0.07 * k, 0.07 * k, 0.02 * k, 20), x * k, hullH + 0.33 * k, sz * 0.39 * B + sz * 0.005, Math.PI / 2))));
    windows.push(put(new T.BoxGeometry(0.02 * k, 0.16 * k, 0.42 * B), 0.34 * k, hullH + 0.36 * k, 0), put(new T.BoxGeometry(0.02 * k, 0.14 * k, 0.4 * B), 0.01 * k, hullH + 0.86 * k, 0));
    const chimney = [put(new T.CylinderGeometry(0.09 * k, 0.11 * k, 0.5 * k, 20), -0.55 * k, hullH + 0.85 * k, 0, 0, 0, 0.15)];
    return partsGeo([['hull', [hull]], ['cabin', cabin], ['windows', windows], ['chimney', chimney]]);
  }
  // ------------------------------------------------------------------ scenery objects
  // a lumpy rock: a round shape pushed in and out by a few waves (the same point always moves the same way, so the
  // faces stay joined); faceted like a real stone
  function lumpy(r, seed, detail = 2, rough = 0.28) {
    const g = new T.IcosahedronGeometry(r, detail), pos = g.attributes.position, k = [1, 2, 3, 4, 5, 6].map((i) => rnd2(seed, i) * 6.28);
    for (let i = 0; i < pos.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(pos, i).normalize();
      const n = Math.sin(v.x * 2.1 + k[0]) * Math.cos(v.y * 1.7 + k[1]) * 0.5 + Math.sin(v.z * 3.3 + k[2]) * 0.3 + Math.sin((v.x + v.y) * 5.1 + k[3]) * 0.15 + Math.cos((v.y - v.z) * 7.3 + k[4]) * 0.08;
      v.multiplyScalar(r * (1 + rough * n)); pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  }
  const lathe = (pts, segs = 32) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), segs);
  function sceneryGeo(p) {
    const k = p.size || 1, seed = p.seed || 1;
    switch (p.type) {
      case 'rock': { const g = lumpy(0.9 * k, seed); g.scale(1.2, 0.75, 1); return partsGeo([['rock', [g]]]); }
      case 'asteroid': {
        const g = lumpy(1 * k, seed, 3, 0.35), pos = g.attributes.position, dents = [0, 1, 2, 3, 4].map((i) => new T.Vector3(rnd2(seed, i + 10) - 0.5, rnd2(seed, i + 20) - 0.5, rnd2(seed, i + 30) - 0.5).normalize());
        for (let i = 0; i < pos.count; i++) { const v = new T.Vector3().fromBufferAttribute(pos, i), dir = v.clone().normalize(); let d = 0; dents.forEach((c) => { const a = dir.angleTo(c); if (a < 0.45) d += (1 - a / 0.45) ** 2 * 0.18; }); v.multiplyScalar(1 - d); pos.setXYZ(i, v.x, v.y, v.z); }
        g.computeVertexNormals(); g.scale(1.3, 0.9, 1); return partsGeo([['rock', [g]]]);
      }
      case 'crater': { const R = 2 * k, rim = lathe([[R * 0.55, 0], [R * 0.85, 0.32 * k], [R, 0.3 * k], [R * 1.35, 0]], 48), floor = new T.CircleGeometry(R * 0.6, 48); floor.rotateX(-Math.PI / 2); floor.translate(0, 0.02, 0); return partsGeo([['rim', [rim]], ['floor', [floor]]]); }
      case 'rocket': {
        const body = lathe([[0, 0], [0.45 * k, 0], [0.5 * k, 0.6 * k], [0.5 * k, 2.4 * k], [0.38 * k, 3.1 * k], [0.18 * k, 3.6 * k], [0, 3.85 * k]], 40);
        const fins = [0, 1, 2].map((i) => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0.75 * k, -0.15 * k); sh.lineTo(0.7 * k, 0.35 * k); sh.lineTo(0, 1.1 * k); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: 0.08 * k, bevelEnabled: false }); g.translate(0.42 * k, 0.15 * k, -0.04 * k); g.rotateY((i / 3) * Math.PI * 2); return g; });
        const nozzle = put(lathe([[0.25 * k, 0], [0.35 * k, -0.35 * k], [0.4 * k, -0.4 * k]], 24), 0, 0, 0);
        const win = put(new T.CylinderGeometry(0.2 * k, 0.2 * k, 0.06 * k, 24), 0, 2.4 * k, 0.48 * k, Math.PI / 2), frame = put(new T.TorusGeometry(0.21 * k, 0.04 * k, 8, 24), 0, 2.4 * k, 0.5 * k);
        return partsGeo([['body', [body]], ['fins', [...fins, nozzle, frame]], ['window', [win]]]);
      }
      case 'ufo': {
        const hull = lathe([[0, -0.25 * k], [0.8 * k, -0.3 * k], [1.6 * k, -0.05 * k], [1.7 * k, 0.05 * k], [1.2 * k, 0.25 * k], [0.6 * k, 0.32 * k], [0, 0.33 * k]], 48);
        const dome = new T.SphereGeometry(0.65 * k, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, 0.28 * k, 0);
        const lights = Array.from({ length: 10 }, (_, i) => put(new T.SphereGeometry(0.09 * k, 10, 8), Math.cos((i / 10) * Math.PI * 2) * 1.55 * k, 0, Math.sin((i / 10) * Math.PI * 2) * 1.55 * k));
        return partsGeo([['hull', [hull]], ['dome', [dome]], ['lights', lights]]);
      }
      case 'sailboat': {
        const L = 2.4 * k, B = 0.8 * k, sh = new T.Shape(); sh.moveTo(-L / 2, -B / 2); sh.lineTo(L * 0.1, -B / 2); sh.quadraticCurveTo(L / 2, -B * 0.3, L / 2, 0); sh.quadraticCurveTo(L / 2, B * 0.3, L * 0.1, B / 2); sh.lineTo(-L / 2, B / 2); sh.closePath();
        const hull = new T.ExtrudeGeometry(sh, { depth: 0.4 * k, bevelEnabled: true, bevelThickness: 0.04 * k, bevelSize: 0.04 * k, bevelSegments: 3, curveSegments: 20 }); hull.rotateX(-Math.PI / 2);
        const hp = hull.attributes.position; for (let i = 0; i < hp.count; i++) { const t = Math.max(0, Math.min(1, hp.getY(i) / (0.4 * k))); hp.setZ(i, hp.getZ(i) * (0.55 + 0.45 * t)); } hull.computeVertexNormals();
        const mast = put(new T.CylinderGeometry(0.04 * k, 0.05 * k, 3 * k, 12), 0, 1.9 * k, 0), boom = put(new T.CylinderGeometry(0.03 * k, 0.03 * k, 1.2 * k, 8), -0.6 * k, 0.75 * k, 0, 0, 0, Math.PI / 2);
        const sailShape = (pts) => { const ss = new T.Shape(); ss.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => ss.lineTo(x, y)); ss.closePath(); return [new T.ShapeGeometry(ss)]; };
        const main = sailShape([[-0.05 * k, 0.8 * k], [-1.2 * k, 0.8 * k], [-0.05 * k, 3.3 * k]]), jib = sailShape([[0.05 * k, 0.6 * k], [1.15 * k, 0.55 * k], [0.05 * k, 3 * k]]);
        return partsGeo([['hull', [hull]], ['mast', [mast, boom]], ['sails', [...main, ...jib]]]);
      }
      case 'lighthouse': {
        const H = 5 * k, tower = [], stripes = [], bands = 6;
        for (let i = 0; i < bands; i++) { const y0 = (i / bands) * H, y1 = ((i + 1) / bands) * H, r0 = 0.8 * k * (1 - 0.35 * (i / bands)), r1 = 0.8 * k * (1 - 0.35 * ((i + 1) / bands)); (i % 2 ? stripes : tower).push(put(new T.CylinderGeometry(r1, r0, y1 - y0, 32), 0, (y0 + y1) / 2, 0)); }
        tower.push(put(new T.CylinderGeometry(0.7 * k, 0.7 * k, 0.1 * k, 32), 0, H + 0.05 * k, 0));
        const lantern = put(new T.CylinderGeometry(0.4 * k, 0.4 * k, 0.6 * k, 24), 0, H + 0.4 * k, 0), roof = put(new T.ConeGeometry(0.55 * k, 0.6 * k, 24), 0, H + 1 * k, 0);
        return partsGeo([['tower', tower], ['stripes', stripes], ['lantern', [lantern]], ['roof', [roof]]]);
      }
      case 'umbrella': {
        const R = 1.5 * k, hgt = 2.4 * k, canopy = [], stripes = [], n = 8;
        for (let i = 0; i < n; i++) { const g = new T.ConeGeometry(R, 0.55 * k, 6, 1, true, (i / n) * Math.PI * 2, (Math.PI * 2) / n); g.translate(0, hgt, 0); (i % 2 ? stripes : canopy).push(g); }
        const pole = put(new T.CylinderGeometry(0.04 * k, 0.04 * k, hgt + 0.3 * k, 10), 0, (hgt + 0.3 * k) / 2, 0);
        return partsGeo([['canopy', canopy], ['stripes', stripes], ['pole', [pole]]]);
      }
      case 'chip': {
        const n = Math.max(2, p.pins | 0 || 8), W = 2 * k, D = Math.max(1, n * 0.22) * k, Hh = 0.25 * k, pins = [];
        const body = new T.RoundedBoxGeometry(W, Hh, D, 2, 0.03 * k); body.translate(0, Hh / 2 + 0.12 * k, 0);
        for (let i = 0; i < n; i++) { const z = -D / 2 + (D / n) * (i + 0.5); [-1, 1].forEach((sx) => { pins.push(put(new T.BoxGeometry(0.28 * k, 0.04 * k, 0.07 * k), sx * (W / 2 + 0.1 * k), 0.2 * k, z), put(new T.BoxGeometry(0.04 * k, 0.2 * k, 0.07 * k), sx * (W / 2 + 0.22 * k), 0.1 * k, z)); }); }
        const mark = put(new T.CylinderGeometry(0.1 * k, 0.1 * k, 0.01 * k, 16), -W / 2 + 0.3 * k, Hh + 0.125 * k, -D / 2 + 0.3 * k);
        const label = put(new T.BoxGeometry(W * 0.5, 0.005 * k, D * 0.25), 0.1 * k, Hh + 0.123 * k, 0);
        return partsGeo([['body', [body]], ['pins', pins], ['mark', [mark, label]]]);
      }
      case 'capacitor': {
        const R = 0.5 * k, H = 1.4 * k, legs = [-1, 1].map((sx) => put(new T.CylinderGeometry(0.03 * k, 0.03 * k, 0.6 * k, 8), sx * 0.2 * k, 0.3 * k, 0));
        const body = put(new T.CylinderGeometry(R, R, H, 32), 0, 0.6 * k + H / 2, 0), top = put(new T.CylinderGeometry(R * 0.96, R * 0.96, 0.03 * k, 32), 0, 0.6 * k + H + 0.01 * k, 0);
        const stripe = put(new T.CylinderGeometry(R * 1.01, R * 1.01, H * 0.98, 32, 1, true, -0.5, 1), 0, 0.6 * k + H / 2, 0);
        return partsGeo([['body', [body]], ['stripe', [stripe]], ['metal', [top, ...legs]]]);
      }
      case 'streetlamp': {
        const H = 5 * k, pole = [put(new T.CylinderGeometry(0.07 * k, 0.12 * k, H, 16), 0, H / 2, 0), put(new T.CylinderGeometry(0.22 * k, 0.28 * k, 0.4 * k, 16), 0, 0.2 * k, 0)];
        pole.push(put(new T.BoxGeometry(1 * k, 0.07 * k, 0.07 * k), 0.48 * k, H - 0.02 * k, 0), put(new T.BoxGeometry(0.5 * k, 0.05 * k, 0.05 * k), 0.22 * k, H - 0.3 * k, 0, 0, 0, 0.6));
        const head = put(new T.CylinderGeometry(0.15 * k, 0.4 * k, 0.3 * k, 16), 0.95 * k, H + 0.3 * k, 0), bulb = put(new T.SphereGeometry(0.2 * k, 16, 10), 0.95 * k, H + 0.1 * k, 0);
        pole.push(head);
        return partsGeo([['pole', pole], ['lamp', [bulb]]]);
      }
      case 'bench': {
        const W = 3 * k, wood = [], metal = [];
        for (let i = 0; i < 3; i++) wood.push(put(new T.BoxGeometry(W, 0.06 * k, 0.16 * k), 0, 0.85 * k, -0.2 * k + i * 0.2 * k));
        for (let i = 0; i < 2; i++) wood.push(put(new T.BoxGeometry(W, 0.16 * k, 0.05 * k), 0, 1.15 * k + i * 0.25 * k, -0.42 * k, -0.25));
        [-1, 1].forEach((sx) => { metal.push(put(new T.BoxGeometry(0.06 * k, 0.85 * k, 0.06 * k), sx * W * 0.4, 0.42 * k, 0.15 * k), put(new T.BoxGeometry(0.06 * k, 1.5 * k, 0.06 * k), sx * W * 0.4, 0.75 * k, -0.35 * k, -0.15), put(new T.BoxGeometry(0.06 * k, 0.06 * k, 0.65 * k), sx * W * 0.4, 0.8 * k, -0.1 * k)); });
        return partsGeo([['wood', wood], ['metal', metal]]);
      }
      case 'trafficcone': {
        const H = 1.4 * k, R = 0.42 * k, cone = [], stripes = [], at = (t) => R * (1 - t) + 0.07 * k * t;
        [[0, 0.3, 0], [0.3, 0.45, 1], [0.45, 0.62, 0], [0.62, 0.74, 1], [0.74, 1, 0]].forEach(([a, b, w]) => (w ? stripes : cone).push(put(new T.CylinderGeometry(at(b), at(a), (b - a) * H, 24), 0, 0.08 * k + ((a + b) / 2) * H, 0)));
        return partsGeo([['cone', cone], ['stripes', stripes], ['base', [put(new T.RoundedBoxGeometry(1.1 * k, 0.08 * k, 1.1 * k, 2, 0.03 * k), 0, 0.04 * k, 0)]]]);
      }
      case 'pine3d': {
        const n = Math.max(2, p.tiers | 0 || 4), H = 4.5 * k, trunk = put(new T.CylinderGeometry(0.15 * k, 0.22 * k, H * 0.3, 10), 0, H * 0.15, 0), tiers = [];
        for (let i = 0; i < n; i++) { const t = i / n, r = 1.3 * k * (1 - t * 0.75), h = (H * 0.85) / n * 1.6; tiers.push(put(new T.ConeGeometry(r, h, 16), 0, H * 0.2 + t * H * 0.72 + h / 2, 0)); }
        return partsGeo([['trunk', [trunk]], ['needles', tiers]]);
      }
      case 'stump': {
        const bark = [put(new T.CylinderGeometry(0.6 * k, 0.72 * k, 0.9 * k, 20, 1, true), 0, 0.45 * k, 0)];
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.4; bark.push(put(new T.ConeGeometry(0.18 * k, 0.6 * k, 8), Math.cos(a) * 0.68 * k, 0.12 * k, Math.sin(a) * 0.68 * k, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2)); }
        const top = put(new T.CylinderGeometry(0.6 * k, 0.6 * k, 0.02 * k, 20), 0, 0.9 * k, 0), rings = [0.2, 0.35, 0.5].map((r) => put(new T.TorusGeometry(r * k, 0.012 * k, 4, 32), 0, 0.912 * k, 0, Math.PI / 2));
        return partsGeo([['bark', [...bark, ...rings]], ['wood', [top]]]);
      }
      case 'mushroom': {
        const stem = lathe([[0, 0], [0.32 * k, 0], [0.26 * k, 0.5 * k], [0.28 * k, 1 * k], [0, 1.02 * k]], 20);
        const cap = new T.SphereGeometry(0.85 * k, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.75, 1); cap.translate(0, 0.95 * k, 0);
        const under = new T.CircleGeometry(0.85 * k, 32); under.rotateX(Math.PI / 2); under.translate(0, 0.95 * k, 0);
        const spots = []; for (let i = 0; i < 9; i++) { const a = rnd2(i, 1) * Math.PI * 2, el = 0.3 + rnd2(i, 2) * 0.9, dir = new T.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el) * 0.75, Math.sin(a) * Math.cos(el)).multiplyScalar(0.85 * k); const sp = new T.SphereGeometry(0.1 * k, 10, 6); sp.scale(1, 0.4, 1); spots.push(put(sp, dir.x, 0.95 * k + dir.y, dir.z)); }
        return partsGeo([['stem', [stem, under]], ['cap', [cap]], ['spots', spots]]);
      }
      case 'cactus': {
        const H = 3.2 * k, body = [put(new T.CapsuleGeometry(0.35 * k, H - 0.7 * k, 6, 16), 0, H / 2, 0)], flower = [];
        [[-1, 0.4, 0.8], [1, 0.55, 0.65]].forEach(([sx, at, len]) => { if (rnd2(p.seed || 1, sx + 3) < 0.15) return; const y = H * at, r = 0.24 * k; body.push(put(new T.CapsuleGeometry(r, 0.45 * k, 4, 12), sx * 0.5 * k, y, 0, 0, 0, Math.PI / 2), put(new T.CapsuleGeometry(r, len * k, 4, 12), sx * 0.8 * k, y + len * k * 0.5, 0)); flower.push(put(new T.SphereGeometry(0.14 * k, 12, 8), sx * 0.8 * k, y + len * k + 0.32 * k, 0)); });
        flower.push(put(new T.SphereGeometry(0.18 * k, 12, 8), 0, H + 0.05 * k, 0));
        return partsGeo([['cactus', body], ['flower', flower]]);
      }
      case 'bush': { const list = []; for (let i = 0; i < 7; i++) { const a = rnd2(seed, i) * Math.PI * 2, d = 0.5 * k * rnd2(seed, i + 9); list.push(put(lumpy((0.5 + 0.35 * rnd2(seed, i + 20)) * k, seed + i, 2, 0.15), Math.cos(a) * d, (0.45 + 0.35 * rnd2(seed, i + 30)) * k, Math.sin(a) * d)); } return partsGeo([['leaves', list]]); }
      case 'fence': {
        const n = Math.max(2, p.posts | 0 || 5), gap = 1 * k, W = (n - 1) * gap, wood = [];
        for (let i = 0; i < n; i++) { const x = -W / 2 + i * gap; wood.push(put(new T.BoxGeometry(0.12 * k, 1.1 * k, 0.12 * k), x, 0.55 * k, 0)); const tip = new T.ConeGeometry(0.09 * k, 0.15 * k, 4); tip.rotateY(Math.PI / 4); wood.push(put(tip, x, 1.17 * k, 0)); }
        wood.push(put(new T.BoxGeometry(W + 0.2 * k, 0.1 * k, 0.05 * k), 0, 0.4 * k, 0.08 * k), put(new T.BoxGeometry(W + 0.2 * k, 0.1 * k, 0.05 * k), 0, 0.85 * k, 0.08 * k));
        return partsGeo([['wood', wood]]);
      }
    }
    return null;
  }
  E.SCENERY = ['rock', 'asteroid', 'crater', 'rocket', 'ufo', 'sailboat', 'lighthouse', 'umbrella', 'chip', 'capacitor', 'streetlamp', 'bench', 'trafficcone', 'pine3d', 'stump', 'mushroom', 'cactus', 'bush', 'fence'];

  E.shapeSize = (s) => { const [g] = shapeGeo(s); g.computeBoundingBox(); const v = g.boundingBox.getSize(new T.Vector3()); g.dispose(); return v; };

  function shapeGeo(s) {
    const p = { ...E.SHAPES[s.type][1], ...s };
    switch (s.type) {
      case 'box': return [new T.BoxGeometry(p.w, p.h, p.d), SLOTS.box];
      case 'roundbox': return [new T.RoundedBoxGeometry(p.w, p.h, p.d, 6, Math.min(p.round, Math.min(p.w, p.h, p.d) / 2 - 0.001)), SLOTS.box];
      case 'sphere': return [new T.SphereGeometry(p.r, 96, 64), null];
      case 'cylinder': return [new T.CylinderGeometry(p.r, p.r, p.h, 64), SLOTS.cyl];
      case 'cone': return [new T.CylinderGeometry(0, p.r, p.h, 64), SLOTS.cyl];
      case 'pyramid': { const g = new T.CylinderGeometry(0, p.r, p.h, 4); g.rotateY(Math.PI / 4); return [g, SLOTS.cyl]; }
      case 'prism': return [new T.CylinderGeometry(p.r, p.r, p.h, Math.max(3, Math.min(24, p.sides | 0))), SLOTS.cyl];
      case 'torus': return [new T.TorusGeometry(p.r, p.tube, 32, 96), null];
      case 'capsule': return [new T.CapsuleGeometry(p.r, p.h, 12, 32), null];
      case 'plane': { const g = new T.PlaneGeometry(p.w, p.h); return [g, null]; }
      case 'stage': return [stageGeo(p), SLOTS.stage];
      case 'palm': return palmGeo(p);
      case 'table': return tableGeo(p);
      case 'monitor': { const W = (p.size || 24) * 0.133; return flatScreenGeo(W, W * 9 / 16, 0.1, 0.05, W * 9 / 16 * 0.3, 'monitor'); }
      case 'tv': { const W = (p.size || 43) * 0.117; return flatScreenGeo(W, W * 9 / 16, 0.16, 0.04, 0.25, 'tv'); }
      case 'crt': return crtGeo(p);
      case 'boat': return boatGeo(p);
      case 'rock': case 'asteroid': case 'crater': case 'rocket': case 'ufo': case 'sailboat': case 'lighthouse': case 'umbrella': case 'chip': case 'capacitor': case 'streetlamp': case 'bench': case 'trafficcone': case 'pine3d': case 'stump': case 'mushroom': case 'cactus': case 'bush': case 'fence': return sceneryGeo(p);
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
  // Letters one by one: each letter's outlines are read on their own, so letters that overlap (tight fonts such as
  // Bungee) cannot cut holes in each other. Spacing leaves room for the rounded edges plus a small gap, so letters
  // only touch when Letter spacing is turned below zero.
  // A letter's outline as SVG path data (y going down), read straight from its TrueType points: opentype.js 2.0's own
  // drawing gives NaN for some letters (Bungee's E, for one). Letters without points (CFF fonts) use opentype's drawing.
  function glyphPathData(font, glyph, x, y, fs, kx = 1, ky = 1) {
    let pts; try { glyph.getPath(0, 0, fs); pts = glyph.points; } catch (e) { pts = null; }
    if (!pts || !pts.length) { const d = glyph.getPath(x, y, fs).toPathData(2); return /NaN/.test(d) ? '' : d; }
    const k = fs / font.unitsPerEm, X = (p) => +(x + p.x * k * kx).toFixed(2), Y = (p) => +(y - p.y * k * ky).toFixed(2);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true });
    let d = '', contour = [];
    const flush = () => {
      const c = contour; contour = []; if (c.length < 2) return;
      // start on an on-curve point (or between two off-curve ones)
      let s = c.findIndex((p) => p.onCurve), pts2;
      if (s < 0) { const m = mid(c[0], c[1]); pts2 = [m, ...c.slice(1), c[0]]; } else pts2 = [...c.slice(s), ...c.slice(0, s)];
      const start = pts2[0]; d += `M${X(start)} ${Y(start)}`;
      for (let i = 1; i <= pts2.length; i++) {
        const p = pts2[i % pts2.length];
        if (p.onCurve) { if (i < pts2.length) d += `L${X(p)} ${Y(p)}`; continue; }
        const n = pts2[(i + 1) % pts2.length], end = n.onCurve ? n : mid(p, n);
        d += `Q${X(p)} ${Y(p)} ${X(end)} ${Y(end)}`; if (n.onCurve) i++;
      }
      d += 'Z';
    };
    pts.forEach((p) => { contour.push(p); if (p.lastPointOfContour) flush(); }); flush();
    return d;
  }
  // The letters of one line and where each starts. Some fonts use features opentype.js cannot do yet (it stops with
  // "not yet supported"): those are laid out plainly, letter by letter with kerning.
  function lineGlyphs(font, ln, fs, opt) {
    const list = [], k = fs / font.unitsPerEm;
    try {
      let end = font.forEachGlyph(ln, 0, 0, fs, opt, (g, gx) => list.push({ g, x: gx }));
      if (typeof end !== 'number') { const l = list[list.length - 1]; end = l ? l.x + (l.g.advanceWidth || 0) * k + (opt.letterSpacing || 0) * fs : 0; }
      return { list, end };
    } catch (e) {
      list.length = 0; let x = 0, prev = null;
      for (const ch of ln) { const g = font.charToGlyph(ch); if (prev) x += (font.getKerningValue(prev, g) || 0) * k; list.push({ g, x }); x += (g.advanceWidth || 0) * k + (opt.letterSpacing || 0) * fs; prev = g; }
      return { list, end: x };
    }
  }
  // Height: 100% is the font as drawn; taller is also narrower (tall and thin), shorter is wider (short and fat)
  function glyphLayout(font, t) {
    const fs = 100, h = Math.max(0.2, t.height || 1), kx = 1 / Math.sqrt(h), ky = h;
    const lines = String(t.text || ' ').split('\n'), lh = (t.lead || 1.15) * fs * ky, loader = new T.SVGLoader();
    const room = ((2 * 0.8 * (t.bevel || 0)) / (t.size || 1) + 0.02) / kx;
    const opt = { letterSpacing: (t.spacing || 0) / 1000 + room };
    const laid = lines.map((ln) => lineGlyphs(font, ln, fs, opt));
    // a line's width without the extra space after its last letter
    const widths = laid.map((l, i) => Math.max(0, (l.end - (lines[i].length ? opt.letterSpacing * fs : 0)) * kx));
    const maxW = Math.max(...widths), letters = [];
    laid.forEach((l, i) => {
      const x0 = t.align === 'left' ? -maxW / 2 : t.align === 'right' ? maxW / 2 - widths[i] : -widths[i] / 2;
      l.list.forEach(({ g, x }) => {
        const d = glyphPathData(font, g, x0 + x * kx, i * lh, fs, kx, ky); if (!d) return;
        const shapes = [];
        // letters come with y going down: flip them while reading, so the outlines face the right way
        loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="${d}"/></g></svg>`).paths.forEach((p) => T.SVGLoader.createShapes(p).forEach((sh) => shapes.push(sh)));
        if (shapes.length) letters.push(shapes);
      });
    });
    return letters;
  }
  const textShapes = (font, t) => glyphLayout(font, t).flat();
  // Text with a letter animation: every letter is its own piece (in the same place as in the whole word), so each can move.
  function letterGroup(font, m) {
    const t = m.text, letters = glyphLayout(font, t), box = new T.Box2();
    letters.forEach((shapes) => shapes.forEach((sh) => sh.getPoints().forEach((pt) => box.expandByPoint(pt))));
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
      const geo = extrudeShapes(shapes, layerDepth / k, (tr.bevel || 0) / k, 6, tr.ownColours === false ? box : null);
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
  function faceTexture(f, slot) {
    if (!f || f.type === 'none' || f.type === 'solid') return null;
    // a picture on a screen fills the whole screen (the square texture is stretched back to the screen's shape)
    if (slot === 'screen' && f.type === 'picture') f = { ...f, fit: 'stretch' };
    const key = JSON.stringify(f); if (texCache.has(key)) return texCache.get(key);
    // the stand-in is the size of the finished picture: a picture loads a moment later, and the card keeps a texture's first size
    const blank = document.createElement('canvas'); blank.width = blank.height = 1024;
    const tex = new T.CanvasTexture(blank); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const draw = (img) => { tex.image = window.paintCanvas ? window.paintCanvas(1024, 1024, f, img, 1024 / 40) : document.createElement('canvas'); tex.needsUpdate = true; needs = true; if (tex.userData.relief) drawRelief(tex); };
    if (f.type === 'picture' && f.src) { const i = new Image(); i.onload = () => draw(i); i.src = f.src; } else draw(null);
    if (f.type === 'pattern' || f.fit === 'tile') { tex.wrapS = tex.wrapT = T.RepeatWrapping; }
    texCache.set(key, tex); return tex;
  }
  // Relief (emboss) for any picture, pattern or gradient: a normal map made from the picture's brightness (lighter is
  // higher), so the surface catches the light like embossed card or carved stone. One per texture, made again when the
  // picture loads; the strength and which way (raise light or dark) are set per material with normalScale.
  function drawRelief(tex) {
    const src = tex.image; if (!src || !src.width) return;
    const N = 1024, c = tex.userData.relief.image.width ? tex.userData.relief.image : document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N), D = d.data, h = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) h[i] = (0.299 * D[i * 4] + 0.587 * D[i * 4 + 1] + 0.114 * D[i * 4 + 2]) / 255;
    // soften a little so edges get a rounded bevel rather than a one-pixel line
    const b = new Float32Array(N * N), at = (u, v) => h[((v + N) % N) * N + ((u + N) % N)];
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += at(u + i, v + j); b[v * N + u] = s / 9; }
    const bt = (u, v) => b[((v + N) % N) * N + ((u + N) % N)];
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
      const dx = (bt(u + 1, v) - bt(u - 1, v)) * 14, dy = (bt(u, v + 1) - bt(u, v - 1)) * 14, l = Math.hypot(dx, dy, 1), o = (v * N + u) * 4;
      D[o] = (-dx / l * 0.5 + 0.5) * 255; D[o + 1] = (dy / l * 0.5 + 0.5) * 255; D[o + 2] = (1 / l * 0.5 + 0.5) * 255; D[o + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    tex.userData.relief.image = c; tex.userData.relief.needsUpdate = true; needs = true;
  }
  function reliefTexture(tex) {
    if (!tex.userData.relief) {
      const r = new T.CanvasTexture(document.createElement('canvas')); r.colorSpace = T.NoColorSpace; r.wrapS = tex.wrapS; r.wrapT = tex.wrapT; r.anisotropy = 8;
      tex.userData.relief = r; drawRelief(tex);
    }
    return tex.userData.relief;
  }
  // Ripples for water: a tiling normal map made from a few crossing waves
  let waveTex = null;
  function waveTexture() {
    if (waveTex) return waveTex;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), img = x.createImageData(N, N);
    const waves = [[3, 1, 0.0, 1], [1, 4, 1.3, 0.8], [5, -2, 2.1, 0.5], [-2, 7, 0.7, 0.35], [9, 3, 2.9, 0.25], [-6, -8, 1.7, 0.2]];
    const hgt = (u, v) => waves.reduce((sum, [fx, fy, ph, a]) => sum + a * Math.sin((fx * u + fy * v) * Math.PI * 2 / N + ph), 0);
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
      const dx = hgt(u + 1, v) - hgt(u - 1, v), dy = hgt(u, v + 1) - hgt(u, v - 1), n = new T.Vector3(-dx * 3, -dy * 3, 1).normalize(), o = (v * N + u) * 4;
      img.data[o] = (n.x * 0.5 + 0.5) * 255; img.data[o + 1] = (n.y * 0.5 + 0.5) * 255; img.data[o + 2] = (n.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    waveTex = new T.CanvasTexture(c); waveTex.wrapS = waveTex.wrapT = T.RepeatWrapping; waveTex.repeat.set(3, 3);
    return waveTex;
  }
  E.waveTexture = () => waveTexture();
  // Colour cycling: bands of colour that scroll through an object while the animation plays, like the moving colours
  // of old computer logos. mat.cycle = { preset, speed (bands a second), bands, dir: up | down | left | right, front }
  E.CYCLES = {
    retro: ['Retro bands (8-bit)', ['#ff004d', '#ff7a00', '#ffd300', '#3cf000', '#00c8ff', '#3a55ff', '#b44dff', '#ff3df2'], true],
    rainbow: ['Smooth rainbow', null, false],
    fire: ['Fire', ['#3a0000', '#9a0a00', '#ff3000', '#ff8a00', '#ffd200', '#fff4b0', '#ffd200', '#ff8a00', '#ff3000', '#9a0a00'], false],
    ocean: ['Ocean', ['#03256c', '#2541b2', '#1768ac', '#06bee1', '#b8f3ff', '#06bee1', '#1768ac', '#2541b2'], false],
    neon: ['Neon', ['#ff00e5', '#7a00ff', '#00e1ff', '#00ff9d', '#00e1ff', '#7a00ff'], false],
    gold: ['Gold shimmer', ['#5c3d00', '#a67c00', '#e6b422', '#fff1b0', '#e6b422', '#a67c00'], false],
    glow: ['Sunset glow (smooth)', ['#f5a742', '#ec7a64', '#e2508f', '#c53fb4', '#8f35c4', '#c53fb4', '#e2508f', '#ec7a64'], false],
    raster: ['Shaded rainbow bars', ['#ffffff', '#e8e04a', '#f0a03a', '#ee6a3a', '#e8435c', '#d84b9b', '#a64bd8', '#6a4be0', '#3f62e0', '#3aa0e8', '#3ad0d0', '#3ac69a'], true, true],
    copper: ['Copper bars', ['#120018', '#4b0f6b', '#a33dd1', '#ffd1ff', '#a33dd1', '#4b0f6b', '#120018', '#0d2a63', '#2f74d0', '#c9ecff', '#2f74d0', '#0d2a63'], false],
  };
  const cycleCache = new Map();
  function cycleTexture(c) {
    const along = c.dir === 'left' || c.dir === 'right' || c.dir === 'sideways', key = [c.preset, c.bands, along].join('|');
    if (!cycleCache.has(key)) {
      const [, cols, hard, shaded] = E.CYCLES[c.preset] || E.CYCLES.retro, N = 2048, cv = document.createElement('canvas'); cv.width = along ? N : 4; cv.height = along ? 4 : N;
      const x = cv.getContext('2d'), bands = Math.max(1, c.bands || 8);
      for (let i = 0; i < N; i++) {
        const u = (i / N) * bands, k = Math.floor(u), f = u - k;
        let col;
        if (!cols) col = new T.Color().setHSL(((i / N) * bands) % 1, 0.9, 0.55);
        else { const a = new T.Color(cols[k % cols.length]), b = new T.Color(cols[(k + 1) % cols.length]); col = hard ? a : a.lerp(b, f * f * (3 - 2 * f)); }
        if (shaded) { const top = 1 - f; col = col.clone(); if (top > 0.72) col.lerp(new T.Color('#ffffff'), (top - 0.72) * 1.6); else if (top < 0.35) col.multiplyScalar(0.55 + 0.45 * (top / 0.35)); }
        x.fillStyle = '#' + col.getHexString(); if (along) x.fillRect(i, 0, 1, 4); else x.fillRect(0, N - 1 - i, 4, 1);
      }
      cycleCache.set(key, cv);
    }
    const tex = new T.CanvasTexture(cycleCache.get(key)); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = tex.wrapT = T.RepeatWrapping;
    // hard-edged bars stay razor sharp up close
    if (c.preset === 'retro' || c.preset === 'raster') { tex.magFilter = T.NearestFilter; tex.anisotropy = 8; }
    return tex;
  }
  // where the bands are at time t
  function poseCycles(t) {
    root.traverse((o) => { if (!o.isMesh) return; [].concat(o.material).forEach((m) => { const c = m.userData && m.userData.cycle; if (!c || !m.map) return; let off = (t * (c.speed ?? 1)) / Math.max(1, c.bands || 8);
      // back and forth: along one whole set of bands, then back again
      if (c.dir === 'updown' || c.dir === 'sideways') { const u = off % 2; off = u < 1 ? u : 2 - u; }
      if (c.dir === 'left' || c.dir === 'right' || c.dir === 'sideways') m.map.offset.x = c.dir === 'left' ? off : -off; else m.map.offset.y = c.dir === 'down' ? off : -off; }); });
  }
  function material(m, face, slot) {
    const glass = m.glass || 0;
    const mat = new T.MeshPhysicalMaterial({
      color: new T.Color(m.color || '#cccccc'), metalness: m.metal ?? 0, roughness: m.rough ?? 0.4, clearcoat: m.coat || 0, clearcoatRoughness: 0.1,
      transmission: glass, thickness: glass ? 1 : 0, ior: m.ior ?? 1.5, transparent: (m.opacity ?? 1) < 1, opacity: m.opacity ?? 1,
      emissive: m.glow ? new T.Color(m.color || '#ffffff') : new T.Color(0), emissiveIntensity: m.glow || 0,
      specularIntensity: m.spec ?? 1, sheen: m.sheen || 0, sheenRoughness: 0.45, sheenColor: new T.Color(0.35, 0.35, 0.35),
    });
    // metals live on reflections; paint and plastic only need a little
    mat.envMap = envTex; mat.userData.reflect = (m.metal ?? 0) > 0.5 ? 1.5 : 0.6; mat.envMapIntensity = mat.userData.reflect * (E.doc ? E.doc.scene.reflect ?? 1 : 1);
    if (face && face.type === 'solid') mat.color.set(face.color || m.color);
    const tex = faceTexture(face, slot);
    if (tex) { mat.map = tex; mat.color.set('#ffffff'); if (m.glow) mat.emissiveMap = tex, mat.emissive.set('#ffffff'); }
    // relief: the picture's light parts raised (or its dark parts, turned round)
    if (tex && (m.relief || 0) > 0 && !m.waves) { mat.normalMap = reliefTexture(tex); const k = m.relief * (m.reliefDark ? -1 : 1); mat.normalScale.set(k, k); }
    // water: little ripples (a normal map that drifts when the animation plays) and a blue tint deeper in
    if (m.waves) { mat.normalMap = waveTexture(); mat.normalScale.set(0.45, 0.45); mat.attenuationColor = new T.Color(m.color || '#3d8fd1'); mat.attenuationDistance = 2.5; mat.color.lerp(new T.Color('#ffffff'), 0.55); }
    // a screen: glossy glass, and a picture on it lights up like a real screen
    if (m.cycle && m.cycle.preset && m.cycle.preset !== 'none' && !tex && (!m.cycle.front || !slot || slot === 'front') && (!m.cycle.part || slot === m.cycle.part)) {
      // the bands show at full strength (not softened by the scene's brightening), with a little of the light for shape
      const ct = cycleTexture(m.cycle); mat.map = ct; mat.color.set('#4d4d4d'); mat.emissive = new T.Color('#ffffff'); mat.emissiveMap = ct; mat.emissiveIntensity = 0.85; mat.toneMapped = false; mat.metalness = Math.min(mat.metalness, 0.3); mat.userData.cycle = { ...m.cycle };
    }
    if (slot === 'sails' || slot === 'canopy' || slot === 'stripes') mat.side = T.DoubleSide;
    if (slot === 'lamp' || slot === 'lantern' || slot === 'lights') { mat.emissive.copy(mat.color); mat.emissiveIntensity = 1.2; }
    if (slot === 'screen') { mat.roughness = 0.12; mat.metalness = 0; mat.clearcoat = 1; mat.transmission = 0; if (tex) { mat.emissiveMap = tex; mat.emissive.set('#ffffff'); mat.emissiveIntensity = 0.8; } }
    return mat;
  }
  // A picture of a ball in a material (for the material buttons): drawn with the main renderer in a corner of its
  // canvas, copied off, then the view is drawn again. Cached by material and colour.
  const previews = new Map(); let pv = null;
  E.materialPreview = function (key, color, size = 72) {
    const id = key + '|' + color + '|' + size; if (previews.has(id)) return previews.get(id);
    if (!renderer) return '';
    if (!pv) {
      pv = { scene: new T.Scene(), cam: new T.PerspectiveCamera(28, 1, 0.1, 30) };
      pv.cam.position.set(0, 0.35, 4.6); pv.cam.lookAt(0, 0, 0);
      pv.scene.background = new T.Color('#e8ebf0');
      // a checked wall behind, so glass shows that it is see-through
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f4f5f7'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#9aa3b2'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(3, 3);
      const wall = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ map: tex })); wall.position.z = -2.2; pv.scene.add(wall);
      const key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(-2, 3, 3); pv.scene.add(key, new T.AmbientLight(0xffffff, 0.25));
      pv.ball = new T.Mesh(new T.SphereGeometry(1, 64, 40)); pv.scene.add(pv.ball);
    }
    const mat = material({ ...E.defaultMat(color, key), opacity: 1 }); mat.envMapIntensity = mat.userData.reflect; pv.ball.material = mat;
    const pr = renderer.getPixelRatio(), W = renderer.domElement.width, H = renderer.domElement.height, n = Math.round(size * pr);
    if (W < n || H < n) return '';
    const keepVp = renderer.getViewport(new T.Vector4()), keepSc = renderer.getScissor(new T.Vector4()), keepTest = renderer.getScissorTest(), keepShadow = renderer.shadowMap.enabled;
    renderer.setViewport(0, 0, size, size); renderer.setScissor(0, 0, size, size); renderer.setScissorTest(true); renderer.shadowMap.enabled = false;
    renderer.render(pv.scene, pv.cam);
    const out = document.createElement('canvas'); out.width = out.height = n; out.getContext('2d').drawImage(renderer.domElement, 0, H - n, n, n, 0, 0, n, n);
    renderer.setViewport(keepVp); renderer.setScissor(keepSc); renderer.setScissorTest(keepTest); renderer.shadowMap.enabled = keepShadow;
    mat.dispose(); needs = true;
    const url = out.toDataURL('image/png'); previews.set(id, url); return url;
  };
  // one material per named face (front, back, sides, top, bottom), each with its own picture or gradient if set
  function materialsFor(m, slots) {
    const faces = m.faces || {};
    if (!slots) return material(m, faces.all);
    return slots.map((sl) => material(m, faces[sl] || faces.all, sl));
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
    ground.getObjectByName('floor').visible = !!s.groundColor && s.groundStyle !== 'shadow' && !E.groundOverride; // a backdrop's matching ground replaces the floor
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
  // ------------------------------------------------------------------ smoothing the grain of ray-traced renders
  // Two quick passes of the scene with the normal renderer tell the smoothing where the edges are: which way each
  // surface faces and how far away it is, and its plain colour without light. Grain is then averaged away only
  // between neighbours that face the same way, are as far away and have the same colour, so edges and pictures stay sharp.
  function renderAux(cam, W, H) {
    const mk = () => new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType });
    const nrm = mk(), alb = mk();
    const keep = { bg: scene.background, clear: renderer.getClearColor(new T.Color()), alpha: renderer.getClearAlpha(), tm: renderer.toneMapping, shadow: renderer.shadowMap.enabled };
    scene.background = null; renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false; renderer.toneMapping = T.NoToneMapping;
    const nm = new T.ShaderMaterial({ side: T.DoubleSide,
      vertexShader: 'varying vec3 vN; varying float vZ; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying float vZ; void main() { vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * 0.5 + 0.5, vZ); }' });
    scene.overrideMaterial = nm; renderer.setRenderTarget(nrm); renderer.clear(); renderer.render(scene, cam); scene.overrideMaterial = null;
    const swaps = [];
    scene.traverseVisible((x) => {
      if (!x.isMesh) return;
      const one = (m) => new T.MeshBasicMaterial({ color: m && m.color ? m.color.clone() : new T.Color(1, 1, 1), map: (m && m.map) || null, side: m ? m.side : T.FrontSide });
      swaps.push([x, x.material]); x.material = Array.isArray(x.material) ? x.material.map(one) : one(x.material);
    });
    renderer.setRenderTarget(alb); renderer.clear(); renderer.render(scene, cam);
    swaps.forEach(([x, m]) => { [].concat(x.material).forEach((b) => b.dispose()); x.material = m; });
    renderer.setRenderTarget(null); scene.background = keep.bg; renderer.setClearColor(keep.clear, keep.alpha); renderer.toneMapping = keep.tm; renderer.shadowMap.enabled = keep.shadow;
    return { nrm, alb, dispose() { nrm.dispose(); alb.dispose(); nm.dispose(); } };
  }
  const DENOISE_FS = `
    uniform sampler2D tC, tN, tA, tRaw; uniform vec2 texel; uniform float stepW, phiC, useColor, first, last;
    varying vec2 vUv;
    vec3 albAt(vec2 uv) { return pow(max(texture2D(tA, uv).rgb, vec3(0.0)), vec3(1.0 / 2.2)); }
    vec3 illumAt(vec2 uv) { vec3 c = texture2D(tC, uv).rgb; if (first > 0.5 && texture2D(tN, uv).a > 0.0) return c / max(albAt(uv), vec3(0.03)); return c; }
    void main() {
      vec4 n0 = texture2D(tN, vUv), raw = texture2D(tRaw, vUv);
      vec3 c0 = illumAt(vUv);
      if (n0.a <= 0.0) { gl_FragColor = last > 0.5 ? raw : vec4(c0, 1.0); return; }
      vec3 N0 = n0.xyz * 2.0 - 1.0, a0 = albAt(vUv); float z0 = n0.a;
      float k[5]; k[0] = 0.0625; k[1] = 0.25; k[2] = 0.375; k[3] = 0.25; k[4] = 0.0625;
      vec3 sum = vec3(0.0); float wsum = 0.0;
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
        vec2 uv = vUv + vec2(float(i), float(j)) * stepW * texel;
        vec4 nq = texture2D(tN, uv); if (nq.a <= 0.0) continue;
        vec3 cq = illumAt(uv), aq = albAt(uv), dc = cq - c0, da = aq - a0;
        float wn = pow(max(0.0, dot(N0, nq.xyz * 2.0 - 1.0)), 64.0);
        float wz = exp(-abs(nq.a - z0) / (0.04 * z0 * stepW + 1e-4));
        // brightness compared as a ratio, so a shadow stays a shadow while grain of the same brightness averages out
        float rel = length(dc) / (length(c0) + length(cq) + 0.05), wc = useColor > 0.5 ? exp(-rel * rel / (phiC * phiC + 1e-6)) : 1.0;
        float w = k[i + 2] * k[j + 2] * wn * wz * wc * exp(-dot(da, da) / 0.004);
        sum += cq * w; wsum += w;
      }
      vec3 c = wsum > 0.0 ? sum / wsum : c0;
      if (last > 0.5) gl_FragColor = vec4(c * max(a0, vec3(0.03)), raw.a); else gl_FragColor = vec4(c, 1.0);
    }`;
  // Smoothing levels: how many passes, how many of the first ones look only at shapes, and how strongly brightness
  // differences are kept (lower keeps more). Fewer and gentler passes the more samples the picture already has.
  E.SMOOTH = { off: 'Off', light: 'Light', medium: 'Medium', strong: 'Strong' };
  function smoothPlan(level, samples) {
    const phi = Math.max(0.02, Math.min(0.2, 0.6 / Math.sqrt(Math.max(1, samples))));
    if (level === 'light') return { n: 3, shapeOnly: 0, phi: phi * 0.6 };
    if (level === 'strong') return { n: 5, shapeOnly: 2, phi: phi * 1.6 };
    return { n: samples < 100 ? 5 : 4, shapeOnly: samples < 100 ? 1 : 0, phi };
  }
  // The raw picture (a canvas of any size) smoothed at the helper passes' size (dw × dh, twice the finished size where it
  // fits, so edges come out smooth), read back and shrunk to w × h. Returns { make(level) → canvas, dispose() }.
  function makeSmoother(raw, aux, dw, dh, w, h, samples) {
    const tex = new T.CanvasTexture(raw); tex.colorSpace = T.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = T.LinearFilter;
    const rt = [0, 1].map(() => new T.WebGLRenderTarget(dw, dh, { type: T.HalfFloatType, depthBuffer: false })), fin = new T.WebGLRenderTarget(dw, dh, { depthBuffer: false });
    const mat = new T.ShaderMaterial({ uniforms: { tC: { value: tex }, tN: { value: aux.nrm.texture }, tA: { value: aux.alb.texture }, tRaw: { value: tex }, texel: { value: new T.Vector2(1 / dw, 1 / dh) }, stepW: { value: 1 }, phiC: { value: 0.1 }, useColor: { value: 1 }, first: { value: 1 }, last: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: DENOISE_FS, depthTest: false, depthWrite: false, toneMapped: false });
    const qs = new T.Scene(), qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
    const cache = {};
    return {
      make(level) {
        if (!level || level === 'off') return null;
        if (cache[level]) return cache[level];
        const plan = smoothPlan(level, samples), keepTM = renderer.toneMapping, keepRT = renderer.getRenderTarget(); renderer.toneMapping = T.NoToneMapping;
        let src = tex;
        for (let i = 0; i < plan.n; i++) {
          const last = i === plan.n - 1, target = last ? fin : rt[i % 2], u = mat.uniforms;
          u.tC.value = src; u.stepW.value = 1 << i; u.phiC.value = plan.phi; u.useColor.value = i < plan.shapeOnly ? 0 : 1; u.first.value = i === 0 ? 1 : 0; u.last.value = last ? 1 : 0;
          renderer.setRenderTarget(target); renderer.render(qs, qc); src = target.texture;
        }
        const px = new Uint8Array(dw * dh * 4); renderer.readRenderTargetPixels(fin, 0, 0, dw, dh, px);
        renderer.setRenderTarget(keepRT); renderer.toneMapping = keepTM;
        // render targets are read from the bottom row up: turn it the right way while copying
        const big = document.createElement('canvas'); big.width = dw; big.height = dh; const bx = big.getContext('2d'), img = bx.createImageData(dw, dh), row = dw * 4;
        for (let y = 0; y < dh; y++) img.data.set(px.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
        bx.putImageData(img, 0, 0);
        const out = document.createElement('canvas'); out.width = w; out.height = h; const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(big, 0, 0, w, h);
        return (cache[level] = out);
      },
      dispose() { tex.dispose(); rt.forEach((r) => r.dispose()); fin.dispose(); mat.dispose(); aux.dispose(); },
    };
  }

  E.pathRender = function (w, h, o = {}) {
    const v = views.find((x) => !x.ortho), cam = v.cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix();
    const [, samples, bounces] = E.QUALITY[o.quality] || E.QUALITY.good;
    E.busy = true; tc.detach();
    const keep = { bg: scene.background, env: scene.environment, envI: scene.environmentIntensity, grid: grid.visible, ratio: renderer.getPixelRatio(), size: renderer.getSize(new T.Vector2()), helpers: [] };
    scene.traverse((x) => { if (x.userData.helper && x.visible) { keep.helpers.push(x); x.visible = false; } }); grid.visible = false;
    const floor = ground.getObjectByName('floor'), shadow = ground.getObjectByName('shadow'); keep.floor = floor.visible; keep.shadowMat = shadow.material;
    if (o.transparent) { scene.background = null; floor.visible = false; }
    const matte = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }); matte.matte = true; shadow.material = matte; // shadows only
    keep.shadowVis = shadow.visible; if ((floor.visible || E.groundOverride) && ground.visible) shadow.visible = false; // with a floor, the floor itself catches the shadows
    // the same studio room the editor uses, as an environment the path tracer can sample
    const cubeRT = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType }), cubeCam = new T.CubeCamera(0.1, 100, cubeRT), room = new T.RoomEnvironment();
    cubeCam.update(renderer, room); scene.environment = cubeRT.texture; scene.environmentIntensity = 0.8 * ((E.doc && E.doc.scene.reflect) ?? 1);
    // Smoother edges (anti-aliasing): render 2, 3 or 4 times the size and shrink it, within the card's limit and about 16 million pixels
    const k = Math.max(0.25, Math.min(o.edges || 1, Math.min(8192, renderer.capabilities.maxTextureSize || 4096) / Math.max(w, h), Math.max(1, Math.sqrt(16.6e6 / (w * h))))), W = Math.round(w * k), H = Math.round(h * k);
    // the grain is smoothed at twice the finished size where it fits (so its edges are smooth too), then shrunk
    const f = Math.max(0.5, Math.min(2, Math.sqrt(16.6e6 / (w * h)), Math.min(8192, renderer.capabilities.maxTextureSize || 4096) / Math.max(w, h))), dw = Math.round(w * f), dh = Math.round(h * f);
    renderer.setScissorTest(false); renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setViewport(0, 0, W, H);
    // The path tracer numbers materials one per object, so objects with a material per face (front, sides, top…)
    // shifted every colour after them. For the render, each of those is split into one piece per face (sharing
    // the same points), and put back afterwards.
    const split = [];
    root.traverseVisible((x) => {
      if (!x.isMesh || !Array.isArray(x.material) || !x.geometry.groups.length || !x.parent) return;
      const g = x.geometry, parts = g.groups.map((gr) => {
        const sub = new T.BufferGeometry(); Object.entries(g.attributes).forEach(([k, at]) => sub.setAttribute(k, at));
        const idx = g.index ? Array.from(g.index.array.slice(gr.start, gr.start + gr.count)) : Array.from({ length: gr.count }, (_, i) => gr.start + i);
        sub.setIndex(idx);
        const mesh = new T.Mesh(sub, x.material[gr.materialIndex] || x.material[0]);
        mesh.position.copy(x.position); mesh.quaternion.copy(x.quaternion); mesh.scale.copy(x.scale); mesh.castShadow = x.castShadow; mesh.receiveShadow = x.receiveShadow;
        return mesh;
      }).filter((m) => m.geometry.index.count);
      split.push({ x, parts });
    });
    split.forEach(({ x, parts }) => { x.visible = false; parts.forEach((m) => x.parent.add(m)); });
    const unsplit = () => split.forEach(({ x, parts }) => { parts.forEach((m) => { m.removeFromParent(); m.geometry.setIndex(null); m.geometry.dispose(); }); x.visible = true; });
    scene.updateMatrixWorld(true);
    const aux = o.denoise !== false ? renderAux(cam, dw, dh) : null;
    const pt = new T.WebGLPathTracer(renderer), tiles = W * H > 2e6 ? 3 : 2;
    Object.assign(pt, { renderDelay: 0, minSamples: 0, fadeDuration: 0, bounces, transmissiveBounces: 10, filterGlossyFactor: 0.5, renderScale: 1, dynamicLowRes: false, rasterizeScene: false });
    pt.tiles.set(tiles, tiles);
    pt.setScene(scene, cam);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const ox = out.getContext('2d');
    ox.imageSmoothingQuality = 'high';
    const copy = () => { ox.clearRect(0, 0, w, h); ox.drawImage(renderer.domElement, 0, 0, W, H, 0, 0, w, h); };
    let smoother = null;
    let stopped = false, frame = 0;
    const finish = () => {
      pt.dispose(); cubeRT.dispose(); matte.dispose(); unsplit();
      if (aux) {
        // keep the picture at the size it was rendered (sharper to smooth than the shrunk one)
        const raw = document.createElement('canvas'); raw.width = W; raw.height = H; raw.getContext('2d').drawImage(renderer.domElement, 0, 0, W, H, 0, 0, W, H);
        try { smoother = makeSmoother(raw, aux, dw, dh, w, h, Math.floor(pt.samples) || 1); } catch (e) { console.warn('smoothing', e); aux.dispose(); }
      }
      shadow.material = keep.shadowMat; shadow.visible = keep.shadowVis; floor.visible = keep.floor; scene.background = keep.bg; scene.environment = keep.env; scene.environmentIntensity = keep.envI;
      grid.visible = keep.grid; keep.helpers.forEach((x) => (x.visible = true));
      renderer.setPixelRatio(keep.ratio); renderer.setSize(keep.size.x, keep.size.y, false);
      E.busy = false; if (selected) tc.attach(selected); needs = true;
    };
    const step = () => {
      if (stopped) return;
      // one tile a frame, so the window keeps responding (and Stop works) even with a very detailed scene
      pt.renderSample();
      const n = Math.floor(pt.samples); frame++;
      if (n >= samples) { copy(); stopped = true; finish(); o.onDone && o.onDone(out, n, false, smoother); return; }
      if (frame % (tiles * tiles * 2) === 0) { copy(); o.onProgress && o.onProgress(out, n, samples); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return { canvas: out, samples, stop: () => { if (stopped) return; stopped = true; copy(); const n = Math.floor(pt.samples); finish(); o.onDone && o.onDone(out, n, true, smoother); }, edges: +k.toFixed(2) };
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
  // Camera keys: anim.camera.keys = [{ t, pos, target, fov, ease }]. Between keys the camera swings round its target
  // (the distance and angles change smoothly), rather than cutting across in a straight line.
  E.camKeys = () => (E.doc && E.doc.anim && E.doc.anim.camera && E.doc.anim.camera.keys) || [];
  E.camAt = function (t) {
    const ks = E.camKeys(); if (!ks.length) return E.doc.camera;
    if (t <= ks[0].t) return ks[0];
    const last = ks[ks.length - 1]; if (t >= last.t) return last;
    let i = 0; while (i < ks.length - 1 && ks[i + 1].t <= t) i++;
    const k0 = ks[i], k1 = ks[i + 1], u = (EASE[k0.ease || 'ease'] || EASE.ease)(Math.max(0, Math.min(1, (t - k0.t) / Math.max(1e-6, k1.t - k0.t))));
    const V = (a) => new T.Vector3().fromArray(a), t0 = V(k0.target), t1 = V(k1.target), tg = t0.clone().lerp(t1, u);
    const s0 = new T.Spherical().setFromVector3(V(k0.pos).sub(t0)), s1 = new T.Spherical().setFromVector3(V(k1.pos).sub(t1));
    let dth = s1.theta - s0.theta; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2;
    const sp = new T.Spherical(s0.radius + (s1.radius - s0.radius) * u, s0.phi + (s1.phi - s0.phi) * u, s0.theta + dth * u);
    return { pos: tg.clone().add(new T.Vector3().setFromSpherical(sp)).toArray(), target: tg.toArray(), fov: (k0.fov || 40) + ((k1.fov || 40) - (k0.fov || 40)) * u };
  };
  // keep the view as it is now as a camera key at time t (replacing one within half a frame)
  E.setCamKey = function (t, ease) {
    E.saveCamera(); const a = E.anim(); a.camera = { move: 'none', amount: 360, ...(a.camera || {}) };
    const ks = (a.camera.keys = a.camera.keys || []), half = 0.5 / (a.fps || 30), c = JSON.parse(JSON.stringify(E.doc.camera));
    const old = ks.find((k) => Math.abs(k.t - t) < half);
    if (old) Object.assign(old, c, ease ? { ease } : {}); else ks.push({ t: +t.toFixed(4), ...c, ease: ease || 'ease' });
    ks.sort((x, y) => x.t - y.t); lastCamT = null;
  };
  E.removeCamKey = (k) => { const a = E.anim(); if (!a.camera || !a.camera.keys) return; a.camera.keys = a.camera.keys.filter((x) => x !== k); if (!a.camera.keys.length) delete a.camera.keys; };
  let lastCamT = null;
  // Show the scene as it is at time t (seconds). The keyed camera takes over when the time changes (play, scrub, export)
  // or when asked (moveCamera), so looking around while working is not undone by every change.
  E.evalAt = function (t, moveCamera) {
    const a = E.anim(); if (!a) return;
    E.time = Math.max(0, Math.min(a.length, t));
    const tt = E.time;
    if (waveTex) { waveTex.offset.set(tt * 0.035, tt * 0.022); }
    poseCycles(tt);
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
    const v = views.find((x) => !x.ortho), cm = a.camera || {}, keyed = !!(cm.keys && cm.keys.length);
    const camNow = keyed && (moveCamera || lastCamT === null || Math.abs(lastCamT - tt) > 1e-6);
    if (v && E.doc.camera && (!keyed || camNow)) {
      lastCamT = tt;
      const base = keyed ? E.camAt(tt) : E.doc.camera, tgt = new T.Vector3().fromArray(base.target), off = new T.Vector3().fromArray(base.pos).sub(tgt);
      const u = tt / Math.max(0.001, a.length), ang = cm.move === 'turntable' ? d2r(cm.start || 0) + d2r(cm.amount ?? 360) * u : cm.move === 'swing' ? d2r(cm.start || 0) + d2r((cm.amount ?? 60) / 2) * Math.sin(u * Math.PI * 2) : 0; // start: where the turn begins (degrees round from the saved view)
      E.camAngle = cm.move && cm.move !== 'none' ? ang : 0;
      if (keyed || (cm.move && cm.move !== 'none')) {
        E.camLock = true; off.applyAxisAngle(new T.Vector3(0, 1, 0), ang); v.cam.position.copy(tgt).add(off); v.orbit.target.copy(tgt);
        if (keyed) { v.cam.fov = base.fov || 40; v.cam.updateProjectionMatrix(); }
        v.orbit.update(); E.camLock = false;
      }
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
      frame(t) { E.evalAt(t, true); const cam = v.cam.clone(); cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); return renderer.domElement; },
      end() { scene.background = keep.bg; grid.visible = keep.grid; floor.visible = keep.floor; keep.helpers.forEach((x) => (x.visible = true)); renderer.setPixelRatio(keep.ratio); renderer.setSize(keep.size.x, keep.size.y, false); E.busy = false; E.evalAt(keep.time); if (selected) tc.attach(selected); needs = true; },
    };
  };
  E.renderer = () => renderer; E.scene = () => scene; E.root = () => root;
})();
