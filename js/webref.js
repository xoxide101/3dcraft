/* 3DCraft reference pictures from the web (window.WEBREF): when Describe it does not know a word, pictures of it are
   looked up in open image libraries that a web page may search (Openverse, and Wikimedia Commons), ranked so the
   clearest references come first, and one is handed to the picture tools. The picture is a reference for the SHAPE:
   by default the model takes your colour or material, not the picture's pixels.
   Only searches when asked (the words go to those libraries). Each result keeps its title, creator, licence and page.
     search(term) → [{ thumb, title, creator, licence, page, from }]
     load(r) → a data URL of the picture (so its pixels can be read)
     rank(results, term) → the same, best first, each with .score (CLIP: is it a clear "term"?) and .plain (plain background) */
(function () {
  'use strict';
  const OPENVERSE = 'https://api.openverse.org/v1/images/';
  const COMMONS = 'https://commons.wikimedia.org/w/api.php';
  const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  async function openverse(term, n) {
    const u = `${OPENVERSE}?q=${encodeURIComponent(term)}&page_size=${n}&mature=false`;
    const r = await fetch(u); if (!r.ok) throw new Error('Openverse did not answer (' + r.status + ')');
    const d = await r.json();
    return (d.results || []).map((x) => ({ thumb: x.thumbnail, title: x.title || term, creator: x.creator || '', licence: [x.license, x.license_version].filter(Boolean).join(' ').toUpperCase(), page: x.foreign_landing_url || x.url, from: 'Openverse' }));
  }
  async function commons(term, n) {
    const u = `${COMMONS}?action=query&generator=search&gsrsearch=${encodeURIComponent(term + ' filetype:bitmap|drawing')}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=500&format=json&origin=*`;
    const r = await fetch(u); if (!r.ok) throw new Error('Wikimedia Commons did not answer (' + r.status + ')');
    const d = await r.json(), pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    return pages.filter((p) => p.imageinfo && p.imageinfo[0].thumburl && /image\/(png|jpeg|svg|webp|gif)/.test(p.imageinfo[0].mime)).map((p) => {
      const i = p.imageinfo[0], m = i.extmetadata || {};
      return { thumb: i.thumburl, title: strip(m.ObjectName && m.ObjectName.value) || p.title.replace(/^File:/, '').replace(/\.\w+$/, ''), creator: strip(m.Artist && m.Artist.value), licence: strip(m.LicenseShortName && m.LicenseShortName.value), page: i.descriptionurl, from: 'Wikimedia Commons' };
    });
  }
  // A long description rarely matches a picture's title word for word ("arcade case tempest by atari" finds nothing), so
  // it is tried as given, then without the small words, then in shorter runs of its words ("arcade cabinet tempest",
  // "tempest atari"…), most specific first, until there are enough pictures. A few everyday words are swapped for
  // the words picture libraries use (an arcade "case" is a "cabinet").
  const SMALL = new Set(['a', 'an', 'the', 'by', 'of', 'for', 'with', 'from', 'in', 'on', 'and', 'made', 'some', 'my', 'like']);
  const SWAP = { case: 'cabinet', machine: 'cabinet' };
  function queries(term) {
    const words = term.trim().split(/\s+/).filter(Boolean), core = words.filter((w) => !SMALL.has(w.toLowerCase())).map((w, i, all) => (SWAP[w.toLowerCase()] && all.some((x) => /arcade/i.test(x)) ? SWAP[w.toLowerCase()] : w));
    const qs = [term.trim(), core.join(' ')];
    for (let len = core.length - 1; len >= 2; len--) for (let i = 0; i + len <= core.length; i++) qs.push(core.slice(i, i + len).join(' '));
    if (core.length === 1) qs.push(core[0]);
    return [...new Set(qs.filter(Boolean))].slice(0, 9);
  }
  // both libraries, mixed (one from each in turn), without repeats; broader searches only while there are too few
  async function search(term, n = 12, onTry = () => {}) {
    const out = [], seen = new Set(); let reached = false;
    for (const q of queries(term)) {
      onTry(q);
      const [a, b] = await Promise.all([openverse(q, n).then((x) => { reached = true; return x; }).catch(() => []), commons(q, n).then((x) => { reached = true; return x; }).catch(() => [])]);
      for (let i = 0; i < Math.max(a.length, b.length); i++) for (const r of [a[i], b[i]]) if (r && !seen.has(r.thumb)) { seen.add(r.thumb); r.query = q; out.push(r); }
      if (out.length >= n) break;
    }
    if (!out.length) throw new Error(reached ? `No pictures of “${term}” were found, even with fewer words. Try other words.` : 'The picture libraries could not be reached: is the computer online?');
    return out.slice(0, Math.max(n, 16));
  }
  // a picture as a data URL: both libraries allow pages to read their thumbnails' pixels
  function load(r) {
    return new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { try { const k = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); } catch (e) { rej(new Error('That picture could not be read.')); } };
      im.onerror = () => rej(new Error('That picture could not be loaded.'));
      im.src = r.thumb;
    });
  }
  // a plain background makes a good reference: how alike the colours round the edge are (1 = all one colour)
  function plainness(src) {
    return new Promise((res) => {
      const im = new Image(); im.onload = () => {
        const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
        const d = x.getImageData(0, 0, N, N).data, edge = []; for (let i = 0; i < N; i++) for (const [px, py] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) { const o = (py * N + px) * 4; edge.push([d[o], d[o + 1], d[o + 2]]); }
        const m = [0, 1, 2].map((q) => edge.reduce((s, e) => s + e[q], 0) / edge.length), spread = edge.reduce((s, e) => s + Math.hypot(e[0] - m[0], e[1] - m[1], e[2] - m[2]), 0) / edge.length;
        res(Math.max(0, 1 - spread / 60));
      }; im.onerror = () => res(0); im.src = src;
    });
  }
  // a solid shape makes a good reference, a line drawing does not: of the box round whatever is not background, how
  // much is filled (a silhouette or a photo of the thing: half or more; thin lines on white: a tenth or so)
  function solidity(src) {
    return new Promise((res) => {
      const im = new Image(); im.onload = () => {
        const N = 96, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
        const d = x.getImageData(0, 0, N, N).data, e = [0, 1, 2].map((q) => (d[q] + d[(N - 1) * 4 + q] + d[(N * (N - 1)) * 4 + q] + d[(N * N - 1) * 4 + q]) / 4);
        let n = 0, x0 = N, x1 = -1, y0 = N, y1 = -1;
        for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) { const o = (py * N + px) * 4; if (Math.hypot(d[o] - e[0], d[o + 1] - e[1], d[o + 2] - e[2]) > 60) { n++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } }
        res(x1 < 0 ? 0 : n / ((x1 - x0 + 1) * (y1 - y0 + 1)));
      }; im.onerror = () => res(0); im.src = src;
    });
  }
  // best first: is it clearly the thing (CLIP, when AI helpers are on), on a plain background, the whole of it
  async function rank(results, term, onEach = () => {}) {
    const labels = [`a ${term}`, 'a photo of a landscape or a scene', 'text or a document', 'a pattern or texture', 'a map or a diagram', 'a person'];
    for (const r of results) {
      try {
        r.src = await load(r); r.plain = await plainness(r.src); r.solid = await solidity(r.src);
        if (window.CRAFTAI && CRAFTAI.enabled('recog')) { const res = await CRAFTAI.recognise(r.src, labels); r.clip = (res.find((x) => x.label === labels[0]) || {}).score || 0; } else r.clip = 0.5;
        r.score = r.clip * (0.45 + 0.55 * r.plain) * Math.min(1, 0.25 + r.solid / 0.4);
      } catch (e) { r.score = -1; r.error = e.message; }
      onEach(r);
    }
    return results.filter((r) => r.score >= 0).sort((a, b) => b.score - a.score);
  }
  window.WEBREF = { queries, search, load, rank, plainness, solidity };
})();
