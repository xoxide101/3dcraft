/* 3DCraft Describe it (window.DESCRIBE): type what you want ("a red mug", "three palm trees and a gold star",
   "the word "HELLO" in chrome") and it is made from 3DCraft's own shapes, objects and round recipes.
   read(text) → { items: [{ what, count, colour, preset, size, tall, wide, hollow, text, label }], unknown: [words] }:
   the plan, shown before anything is made, so you see what it understood. make(plan) builds it.
   Words are matched to the catalogue by their names and everyday synonyms; when nothing matches and the AI helpers are
   on, the closest thing by meaning is found with CLIP's text model (CRAFTAI.closest). It never invents a shape it
   cannot build: it says what it does not know yet. */
(function () {
  'use strict';
  // ------------------------------------------------------------------ what can be made
  // [key, label, words…]: shapes and objects use E3.SHAPES types; round: recipes are spun from a drawn outline
  const CATALOG = [
    ['box', 'Box', 'box', 'cube', 'block', 'crate', 'brick', 'square'], ['roundbox', 'Rounded box', 'rounded box', 'soft box', 'rounded cube', 'pillow'],
    ['sphere', 'Sphere', 'sphere', 'ball', 'orb', 'globe', 'planet', 'marble', 'bubble'], ['cylinder', 'Cylinder', 'cylinder', 'tube', 'pillar', 'column', 'pipe', 'drum', 'coin', 'disc', 'disk'],
    ['cone', 'Cone', 'cone', 'spike'], ['pyramid', 'Pyramid', 'pyramid'], ['prism', 'Prism', 'prism', 'hexagon', 'octagon', 'pentagon', 'triangle'],
    ['torus', 'Ring (doughnut)', 'doughnut', 'donut', 'torus', 'ring', 'tyre', 'tire', 'lifebuoy', 'bagel'], ['washer', 'Flat ring', 'washer', 'flat ring', 'gasket'],
    ['capsule', 'Capsule', 'capsule', 'pill', 'sausage'], ['star', 'Star', 'star'], ['heart', 'Heart', 'heart', 'love'], ['plane', 'Flat panel', 'panel', 'board', 'sheet', 'plate', 'wall'],
    ['stage', 'Stage', 'stage', 'podium', 'platform', 'pedestal', 'plinth'],
    ['palm', 'Palm tree', 'palm tree', 'palm', 'coconut tree'], ['table', 'Table', 'table', 'desk'], ['monitor', 'Computer monitor', 'monitor', 'computer', 'screen', 'display'],
    ['tv', 'Flat TV', 'tv', 'television', 'flat screen', 'telly'], ['crt', 'CRT TV', 'crt', 'old tv', 'old television', 'retro tv'], ['boat', 'Test boat', 'boat', 'ship', 'tugboat'],
    ['rock', 'Rock', 'rock', 'stone', 'boulder', 'pebble'], ['asteroid', 'Asteroid', 'asteroid', 'meteor', 'meteorite'], ['crater', 'Crater', 'crater'],
    ['rocket', 'Rocket', 'rocket', 'spaceship', 'space ship', 'missile'], ['ufo', 'Flying saucer', 'ufo', 'flying saucer', 'alien ship', 'saucer'], ['sailboat', 'Sailboat', 'sailboat', 'sail boat', 'yacht', 'dinghy'],
    ['lighthouse', 'Lighthouse', 'lighthouse'], ['umbrella', 'Beach umbrella', 'umbrella', 'parasol', 'sunshade'], ['chip', 'Microchip', 'chip', 'microchip', 'cpu', 'processor'],
    ['capacitor', 'Capacitor', 'capacitor'], ['streetlamp', 'Street lamp', 'street lamp', 'lamp post', 'lamppost', 'street light'], ['bench', 'Bench', 'bench', 'park bench', 'seat'],
    ['trafficcone', 'Traffic cone', 'traffic cone', 'road cone', 'safety cone'], ['pine3d', 'Pine tree', 'pine tree', 'pine', 'fir', 'fir tree', 'christmas tree', 'evergreen', 'tree'],
    ['stump', 'Tree stump', 'stump', 'tree stump', 'log'], ['mushroom', 'Mushroom', 'mushroom', 'toadstool'], ['cactus', 'Cactus', 'cactus', 'cacti'], ['bush', 'Bush', 'bush', 'shrub', 'hedge'],
    ['flag', 'Flag', 'flag', 'banner'], ['fence', 'Fence', 'fence', 'railing'],
    ['round:cup', 'Cup', 'cup', 'coffee cup', 'paper cup', 'takeaway cup', 'tumbler'], ['round:mug', 'Mug', 'mug', 'tea cup', 'teacup', 'coffee mug', 'stein'],
    ['round:vase', 'Vase', 'vase', 'urn', 'amphora'], ['round:bottle', 'Bottle', 'bottle', 'flask'], ['round:glass', 'Wine glass', 'wine glass', 'goblet', 'chalice', 'glass'],
    ['round:bowl', 'Bowl', 'bowl', 'dish'], ['round:jar', 'Jar', 'jar', 'pot of jam', 'canister'], ['round:trophy', 'Trophy', 'trophy', 'award', 'prize cup'],
    ['round:pawn', 'Chess pawn', 'pawn', 'chess pawn', 'chess piece'], ['round:candle', 'Candle', 'candle'], ['round:flowerpot', 'Flower pot', 'flower pot', 'plant pot', 'planter'],
    ['round:bucket', 'Bucket', 'bucket', 'pail'],
  ];
  // round recipes: the side outline as [down 0–1, half width 0–1] points, height ÷ width, hollow or not, a handle
  const ROUND = {
    cup: { h: 1.2, hollow: true, p: [[0, 0.45], [1, 0.34]] },
    mug: { h: 1.0, hollow: true, handle: true, p: [[0, 0.36], [1, 0.36]] },
    vase: { h: 1.6, hollow: true, p: [[0, 0.24], [0.06, 0.2], [0.22, 0.17], [0.4, 0.3], [0.58, 0.42], [0.78, 0.38], [0.94, 0.26], [1, 0.24]] },
    bottle: { h: 2.6, p: [[0, 0.1], [0.12, 0.1], [0.14, 0.12], [0.24, 0.12], [0.36, 0.26], [0.44, 0.3], [1, 0.3]] },
    glass: { h: 1.8, hollow: true, p: [[0, 0.3], [0.2, 0.31], [0.38, 0.24], [0.46, 0.06], [0.5, 0.03], [0.86, 0.03], [0.94, 0.22], [1, 0.27]] },
    bowl: { h: 0.45, hollow: true, p: [[0, 0.48], [0.35, 0.46], [0.75, 0.32], [0.9, 0.2], [1, 0.2]] },
    jar: { h: 1.1, p: [[0, 0.27], [0.1, 0.27], [0.12, 0.36], [0.18, 0.4], [1, 0.4]] },
    trophy: { h: 1.6, p: [[0, 0.42], [0.25, 0.38], [0.42, 0.22], [0.5, 0.07], [0.72, 0.06], [0.78, 0.18], [0.84, 0.3], [1, 0.3]] },
    pawn: { h: 1.7, p: [[0, 0.06], [0.04, 0.15], [0.14, 0.18], [0.24, 0.13], [0.3, 0.2], [0.34, 0.09], [0.66, 0.15], [0.8, 0.28], [0.88, 0.3], [1, 0.33]] },
    candle: { h: 2.2, p: [[0, 0.015], [0.07, 0.015], [0.08, 0.17], [1, 0.17]] },
    flowerpot: { h: 0.9, hollow: true, p: [[0, 0.45], [0.12, 0.45], [0.13, 0.4], [1, 0.31]] },
    bucket: { h: 0.9, hollow: true, p: [[0, 0.44], [1, 0.34]] },
  };
  const NUM = { a: 1, an: 1, one: 1, two: 2, pair: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, few: 3, several: 4 };
  const MAT_WORDS = { gold: 'gold', golden: 'gold', silver: 'silver', chrome: 'chrome', shiny: 'gloss', glossy: 'gloss', copper: 'copper', bronze: 'copper', brass: 'gold', glass: 'glass', see: 'glass', clear: 'glass', crystal: 'glass', glowing: 'glow', glow: 'glow', neon: 'glow', cotton: 'cotton', cloth: 'cotton', fabric: 'cotton', denim: 'denim', velvet: 'velvet', silk: 'silk', felt: 'felt', water: 'water', rubber: 'rubber', matte: 'matte', plastic: 'plastic', metal: 'chrome', metallic: 'silver' };
  const SIZE = { tiny: 0.4, little: 0.6, small: 0.7, big: 1.5, large: 1.5, huge: 2.2, giant: 2.5, massive: 2.5, enormous: 2.5 };
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9"' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sing = (w) => (w.length > 3 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /(ch|sh|x|ss)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
  // is this word a colour? (the browser knows the CSS names; light/dark/pale/bright change them)
  const ctx = document.createElement('canvas').getContext('2d');
  const colourOf = (w) => { ctx.fillStyle = '#010203'; ctx.fillStyle = w; const v = ctx.fillStyle; return v === '#010203' ? null : v; };
  const shadeBy = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k))); return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''); };

  // one item from a phrase like "two big red shiny palm trees"
  function item(phrase) {
    const it = { count: 1, size: 1, tall: 1, wide: 1, colour: null, preset: null, hollow: null, what: null, phrase };
    let s = ' ' + phrase + ' ';
    // words of 3D text: "the word "HI"", 'text "HELLO"'
    const q = phrase.match(/["“”']([^"“”']+)["“”']/);
    if (q) { it.what = 'text'; it.text = q[1]; it.label = `3D text “${q[1]}”`; s = s.replace(q[0], ' '); }
    const words = norm(s).split(' ').filter(Boolean), used = new Set();
    let shade = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (/^\d+$/.test(w) && i === 0) { used.add(i); it.count = Math.min(30, +w); continue; }
      if (NUM[w] != null && i <= 1) { used.add(i); it.count = NUM[w]; continue; }
      if (SIZE[w]) { used.add(i); it.size *= SIZE[w]; continue; }
      if (w === 'tall' || w === 'long') { used.add(i); it.tall *= 1.6; continue; }
      if (w === 'short' || w === 'flat' || w === 'squat') { used.add(i); it.tall *= 0.6; continue; }
      if (w === 'wide' || w === 'fat') { used.add(i); it.wide *= 1.5; continue; }
      if (w === 'thin' || w === 'narrow') { used.add(i); it.wide *= 0.7; continue; }
      if (w === 'hollow' || w === 'empty' || w === 'open') { used.add(i); it.hollow = true; continue; }
      if (w === 'solid' || w === 'filled') { used.add(i); it.hollow = false; continue; }
      if (w === 'light' || w === 'pale') { used.add(i); shade = 0.45; continue; }
      if (w === 'dark' || w === 'deep') { used.add(i); shade = -0.45; continue; }
      if (w === 'bright') { used.add(i); shade = 0.15; continue; }
      if (MAT_WORDS[w] && !(w === 'glass' && /wine glass|drinking glass/.test(phrase))) { it.preset = MAT_WORDS[w]; if (w === 'gold' || w === 'golden') it.colour = it.colour || '#d4a017'; used.add(i); continue; }
      const c = colourOf(w); if (c && w !== 'tan' && w !== 'linen') { it.colour = shade ? shadeBy(c, shade) : c; it.colourName = (shade > 0.3 ? 'light ' : shade < 0 ? 'dark ' : '') + w; shade = 0; used.add(i); }
    }
    if (it.what) return it;
    // the thing itself: the longest catalogue name or synonym found in the phrase (so "palm tree" wins over "tree")
    // (words already read as a size, colour or material are left out first, so "glass vases" is vases made of glass;
    // if nothing is left, they count again, so "a glass" is still a glass)
    const find = (ws) => { const text = ' ' + ws.map(sing).join(' ') + ' ', plain = ' ' + ws.join(' ') + ' '; let b = null; CATALOG.forEach(([key, label, ...syn]) => syn.forEach((sy) => { if ((text.includes(' ' + sy + ' ') || plain.includes(' ' + sy + ' ')) && (!b || sy.length > b[2].length)) b = [key, label, sy]; })); return b; };
    let best = find(words.filter((w, i) => !used.has(i))) || find(words);
    if (best && best[0] === 'round:glass' && it.preset === 'glass' && !/wine glass|drinking glass/.test(phrase)) it.preset = null;
    if (best) { it.what = best[0]; it.label = best[1]; }
    return it;
  }
  // the noun of a phrase (the last word that is not a size, colour or material), for saying what is not known
  const nounOf = (phrase) => { const w = norm(phrase).split(' ').filter((x) => !NUM[x] && !SIZE[x] && !MAT_WORDS[x] && !colourOf(x) && !/^\d+$/.test(x) && !['with', 'and', 'of', 'the', 'in', 'made', 'some'].includes(x)); return w.slice(-2).join(' '); };

  async function read(text) {
    const parts = String(text || '').split(/\s*(?:,|;|\band\b|\bplus\b|\bthen\b)\s*(?=(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|some|\d+|the|["“]))/i).map((s) => s.trim()).filter(Boolean);
    const items = [], unknown = [];
    for (const p of parts) {
      const it = item(p);
      if (!it.what && window.CRAFTAI && CRAFTAI.enabled('recog')) {
        // not in the word list: the closest thing by meaning (CLIP's text model), if it is close enough
        const noun = nounOf(p);
        try { const c = await CRAFTAI.closest(noun, CATALOG.map((x) => x[1])); if (c && c.score > 0.33 && c.p > 0.6) { const e = CATALOG.find((x) => x[1] === c.label); it.what = e[0]; it.label = e[1]; it.guess = noun; it.score = c.score; } } catch (e) { /* no AI: just say it is unknown */ }
      }
      if (it.what) items.push(it); else unknown.push(nounOf(p) || p);
    }
    return { items, unknown };
  }

  // a round recipe drawn as a side outline (with a handle if it has one) and spun, using Photos to 3D's Round
  function outline(r, colour) {
    const W = 220, H = Math.round(W * r.h), pad = 30, c = document.createElement('canvas'); c.width = W + pad * 2 + (r.handle ? 120 : 0); c.height = H + pad * 2;
    const x = c.getContext('2d'); x.fillStyle = x.strokeStyle = colour; // see-through round it (and inside a handle's loop)
    const cx = pad + W / 2, pt = ([d, h]) => [cx + h * W, pad + d * H];
    x.beginPath(); r.p.forEach((q, i) => { const [px, py] = pt(q); i ? x.lineTo(px, py) : x.moveTo(px, py); }); [...r.p].reverse().forEach(([d, h]) => x.lineTo(cx - h * W, pad + d * H)); x.closePath(); x.fill();
    if (r.handle) { const R = r.p[0][1] * W; x.lineWidth = W * 0.08; x.beginPath(); x.ellipse(cx + R, pad + H * 0.5, W * 0.2, H * 0.28, 0, -Math.PI / 2, Math.PI / 2); x.stroke(); }
    return c.toDataURL('image/png');
  }

  async function make(plan, onStep = () => {}) {
    const made = [];
    for (const it of plan.items) {
      for (let n = 0; n < it.count; n++) {
        onStep(`Making ${it.label}${it.count > 1 ? ` (${n + 1} of ${it.count})` : ''}…`);
        let m;
        if (it.what === 'text') m = UI3.addText(it.text);
        else if (it.what.startsWith('round:')) {
          const r = ROUND[it.what.slice(6)], hollow = it.hollow ?? !!r.hollow;
          m = await UI3.makePhotos3D([outline(r, it.colour || '#e9ecef')], 'one', { shape: 'round', hollow, wall: 0.07, segments: 72, detail: 70, bg: { mode: 'auto', actions: [], tolerance: 30 }, tolerance: 30 });
          if (m) { m.name = it.label; m.model.fit = 2.4 * Math.max(1, r.h * 0.8); }
        } else m = UI3.addShape(it.what, null, it.label);
        if (!m) continue;
        if (it.colour || it.preset) {
          const keepFaces = !it.colour && m.mat && m.mat.faces;
          m.mat = { ...E3.defaultMat(it.colour || (m.mat && m.mat.color) || '#9aa1ab', it.preset || (m.mat && m.mat.preset) || 'plastic'), faces: keepFaces ? m.mat.faces : {} };
          if (it.colour) m.mat.color = it.colour; // (glass, gold… have their own colour; the one asked for wins)
        }
        if (m.kind === 'model' && it.preset) m.model.keepOwn = false;
        if (it.size !== 1 || it.tall !== 1 || it.wide !== 1) m.scale = [it.size * it.wide, it.size * it.tall, it.size * it.wide];
        made.push(m);
      }
    }
    if (made.length) { await E3.rebuild(); made.forEach((m) => UI3.changed(m.id)); E3.fit(); }
    return made;
  }
  // in words, for the plan shown before making
  function say(plan) {
    const lines = plan.items.map((it) => `${it.count > 1 ? it.count + ' × ' : ''}${it.label}${[it.size !== 1 ? (it.size > 1 ? 'bigger' : 'smaller') : '', it.tall > 1 ? 'taller' : it.tall < 1 ? 'shorter' : '', it.wide > 1 ? 'wider' : it.wide < 1 ? 'narrower' : '', it.colour ? it.colourName || it.colour : '', it.preset ? E3.MATERIALS[it.preset][0].toLowerCase() : '', it.hollow === true ? 'hollow' : it.hollow === false ? 'solid' : ''].filter(Boolean).map((x) => ', ' + x).join('')}${it.guess ? ` (for “${it.guess}”: the closest I have)` : ''}`);
    return { lines, unknown: plan.unknown };
  }
  window.DESCRIBE = { read, make, say, CATALOG, ROUND };
})();
