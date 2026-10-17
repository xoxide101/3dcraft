/* 3DCraft: save the animation as an animated GIF, MP4 (H.264), WebM (VP9), AVI (motion JPEG) or a .zip of PNG frames.
   Frames are drawn one by one at exact times, so the result is smooth whatever the computer's speed. */
(function () {
  'use strict';
  const E = window.E3, $ = (id) => document.getElementById(id);
  const SIZES = [[480, 270, '480 × 270 (small GIF)'], [640, 360, '640 × 360'], [854, 480, '854 × 480 (480p)'], [1280, 720, '1280 × 720 (HD)'], [1920, 1080, '1920 × 1080 (Full HD)'], [3840, 2160, '3840 × 2160 (4K)'], [720, 720, '720 × 720 (square)'], [1080, 1080, '1080 × 1080 (square)'], [1080, 1920, '1080 × 1920 (phone, upright)']];
  const FORMATS = {
    gif: ['Animated GIF', 'Plays anywhere: web pages, chats, email. Up to 256 colours per frame.'],
    mp4: ['MP4 video (H.264)', 'The most widely played video: phones, YouTube, editors.'],
    webm: ['WebM video (VP9)', 'Small, sharp video for the web.'],
    avi: ['AVI video (motion JPEG)', 'The classic Windows video, frame by frame. Large files; opens in almost any video editor.'],
    png: ['PNG frames (.zip)', 'Every frame as a picture, numbered, see-through if you like: for video editors and compositing.'],
  };
  $('an-fmt').innerHTML = Object.entries(FORMATS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('');
  $('an-size').innerHTML = SIZES.map(([w, h, n], i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${n}</option>`).join('');
  const sync = () => { const f = $('an-fmt').value; $('an-look').onchange = sync; $('an-tip').textContent = FORMATS[f][1]; $('an-transp-f').hidden = !(f === 'png' || f === 'gif'); const a = E.anim(); if (a) $('an-info').textContent = `${a.length} s at ${a.fps} frames a second = ${Math.round(a.length * a.fps)} frames.`; };
  $('an-fmt').onchange = sync;
  // Ray-traced frames: each frame put in place, path-traced at the chosen quality and smoothed, then added like any frame
  let rtJob = null;
  const rtFrame = (w, h, quality, transparent) => new Promise((res) => {
    rtJob = E.pathRender(w, h, { quality, transparent, edges: 1, onDone: (c, n, early, sm) => { let out = c; try { const m = sm && sm.make('medium'); if (m) out = m; } catch (e) {} if (sm) sm.dispose(); rtJob = null; res(out); } });
  });
  let cancel = false, busy = false;
  window.ANIM3 = { open: () => { if (!E.doc) return; sync(); $('an-status').textContent = ''; $('an-bar').style.width = '0'; $('animdlg').hidden = false; } };
  $('an-close').onclick = () => { if (busy) { cancel = true; if (rtJob) rtJob.stop(); } else $('animdlg').hidden = true; };
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); };
  const baseName = () => (E.doc.name || 'animation').replace(/[^\w -]+/g, '').trim() || 'animation';
  const blobOf = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
  const bytesOf = async (b) => new Uint8Array(await b.arrayBuffer());

  // ---- AVI with motion JPEG frames (RIFF, one video stream, an index for seeking)
  function makeAVI(frames, w, h, fps) {
    const enc = new TextEncoder(), parts = [];
    const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; }, u16 = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
    const cat = (...xs) => { const n = xs.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; xs.forEach((x) => { o.set(x, p); p += x.length; }); return o; };
    const chunk = (id, data) => cat(enc.encode(id), u32(data.length), data, data.length % 2 ? new Uint8Array(1) : new Uint8Array(0));
    const list = (type, ...kids) => { const body = cat(enc.encode(type), ...kids); return cat(enc.encode('LIST'), u32(body.length), body); };
    const maxF = Math.max(...frames.map((f) => f.length)), n = frames.length;
    const avih = cat(u32(Math.round(1e6 / fps)), u32(maxF * fps), u32(0), u32(0x10), u32(n), u32(0), u32(1), u32(maxF), u32(w), u32(h), u32(0), u32(0), u32(0), u32(0));
    const strh = cat(enc.encode('vids'), enc.encode('MJPG'), u32(0), u16(0), u16(0), u32(0), u32(1), u32(fps), u32(0), u32(n), u32(maxF), u32(0xffffffff), u32(0), u16(0), u16(0), u16(w), u16(h));
    const strf = cat(u32(40), u32(w), u32(h), u16(1), u16(24), enc.encode('MJPG'), u32(w * h * 3), u32(0), u32(0), u32(0), u32(0));
    const hdrl = list('hdrl', chunk('avih', avih), list('strl', chunk('strh', strh), chunk('strf', strf)));
    const moviChunks = frames.map((f) => chunk('00dc', f));
    const movi = list('movi', ...moviChunks);
    let off = 4; const idx = [];
    frames.forEach((f, i) => { idx.push(cat(enc.encode('00dc'), u32(0x10), u32(off), u32(f.length))); off += moviChunks[i].length; });
    const body = cat(enc.encode('AVI '), hdrl, movi, chunk('idx1', cat(...idx)));
    parts.push(enc.encode('RIFF'), u32(body.length), body);
    return new Blob(parts, { type: 'video/x-msvideo' });
  }
  // ---- a .zip of files, stored (pictures are compressed already)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    files.forEach((f) => { const name = enc.encode(f.name), crc = crc32(f.bytes), len = f.bytes.length;
      const head = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(len), ...u32(len), ...u16(name.length), ...u16(0)]);
      parts.push(head, name, f.bytes);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(len), ...u32(len), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + len; });
    const cd = central.reduce((a, b) => a + b.length, 0);
    return new Blob([...parts, ...central, new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cd), ...u32(off), 0, 0])], { type: 'application/zip' });
  }
  // ---- video: the browser's encoder (WebCodecs) and the MP4 or WebM muxer
  async function videoEncoder(fmt, w, h, fps) {
    if (!window.VideoEncoder) throw new Error('This browser cannot make videos (it needs WebCodecs: use a current Chrome or Edge), but GIF, AVI and PNG frames work.');
    const tries = fmt === 'mp4' ? ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f'] : ['vp09.00.40.08', 'vp09.00.10.08', 'vp8'];
    const bitrate = Math.round(w * h * fps * 0.12);
    let codec = null;
    for (const c of tries) { try { const s = await VideoEncoder.isConfigSupported({ codec: c, width: w, height: h, bitrate, framerate: fps }); if (s.supported) { codec = c; break; } } catch (e) {} }
    if (!codec) throw new Error(`This browser cannot make ${fmt.toUpperCase()} at ${w} × ${h}. Try a smaller size, or GIF or AVI.`);
    const M = fmt === 'mp4' ? window.MP4Muxer : window.WebMMuxer;
    const muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: fmt === 'mp4' ? { codec: 'avc', width: w, height: h } : { codec: codec.startsWith('vp8') ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: fps }, ...(fmt === 'mp4' ? { fastStart: 'in-memory' } : {}) });
    let error = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { error = e; } });
    enc.configure({ codec, width: w, height: h, bitrate, framerate: fps, ...(fmt === 'mp4' ? { avc: { format: 'avc' } } : {}) });
    return {
      async add(canvas, i) { if (error) throw error; const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) }); enc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close(); while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5)); },
      async done() { await enc.flush(); if (error) throw error; muxer.finalize(); enc.close(); return new Blob([muxer.target.buffer], { type: fmt === 'mp4' ? 'video/mp4' : 'video/webm' }); },
      close() { try { enc.close(); } catch (e) {} },
    };
  }
  // ---- the export
  $('an-go').onclick = async () => {
    if (busy || !E.doc) return;
    const a = E.anim(), fmt = $('an-fmt').value, [w, h] = SIZES[+$('an-size').value], fps = a.fps, n = Math.max(1, Math.round(a.length * fps));
    const transparent = $('an-transp').checked && (fmt === 'png' || fmt === 'gif'), look = $('an-look').value, rt = look !== 'quick';
    busy = true; cancel = false; $('an-go').disabled = true; $('an-close').textContent = 'Cancel';
    const t0 = performance.now(), status = (m) => { $('an-status').textContent = m; };
    let sess = null, vid = null;
    const work = document.createElement('canvas'); work.width = w; work.height = h; const wx = work.getContext('2d', { willReadFrequently: true });
    try {
      if (fmt === 'mp4' || fmt === 'webm') vid = await videoEncoder(fmt, w, h, fps);
      const gif = fmt === 'gif' ? Gifenc.GIFEncoder() : null, jpgs = [], pngs = [];
      if (!rt) sess = E.beginFrames(w, h, { transparent });
      else status('Getting the ray tracer ready: the first frame takes longest (up to half a minute), the rest are quicker…');
      let tFirst = 0;
      for (let i = 0; i < n; i++) {
        if (cancel) throw new Error('cancelled');
        let c; if (rt) { await new Promise((r) => setTimeout(r, 30)); E.evalAt(i / fps, true); c = await rtFrame(w, h, look, transparent); if (cancel) throw new Error('cancelled'); if (i === 0) tFirst = performance.now(); } else c = sess.frame(i / fps);
        wx.clearRect(0, 0, w, h); if (fmt === 'avi' || fmt === 'mp4' || fmt === 'webm' || (fmt === 'gif' && !transparent)) { wx.fillStyle = '#ffffff'; wx.fillRect(0, 0, w, h); } wx.drawImage(c, 0, 0, w, h);
        if (gif) { const d = wx.getImageData(0, 0, w, h).data, pal = Gifenc.quantize(d, 256, transparent ? { format: 'rgba4444', oneBitAlpha: true } : {}), idx = Gifenc.applyPalette(d, pal, transparent ? 'rgba4444' : 'rgb565'); gif.writeFrame(idx, w, h, { palette: pal, delay: Math.round(1000 / fps), transparent, repeat: a.loop === false ? -1 : 0 }); }
        else if (fmt === 'avi') jpgs.push(await bytesOf(await blobOf(work, 'image/jpeg', 0.9)));
        else if (fmt === 'png') pngs.push({ name: `${baseName()}-${String(i + 1).padStart(4, '0')}.png`, bytes: await bytesOf(await blobOf(work, 'image/png')) });
        else await vid.add(work, i);
        $('an-bar').style.width = Math.round(((i + 1) / n) * 100) + '%';
        { const el = (performance.now() - t0) / 1000, per = rt && i > 0 ? (performance.now() - tFirst) / 1000 / i : 0, left = Math.round(per * (n - i - 1)); status(`Frame ${i + 1} of ${n} · ${Math.round(el)} s` + (rt && i > 0 && i < n - 1 ? ` · about ${left >= 120 ? Math.round(left / 60) + ' min' : left + ' s'} to go` : '')); }
        if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
      }
      if (sess) { sess.end(); sess = null; }
      status('Putting the file together…');
      let blob;
      if (gif) { gif.finish(); blob = new Blob([gif.bytes()], { type: 'image/gif' }); }
      else if (fmt === 'avi') blob = makeAVI(jpgs, w, h, fps);
      else if (fmt === 'png') blob = makeZip(pngs);
      else blob = await vid.done();
      const ext = fmt === 'png' ? 'zip' : fmt;
      download(blob, `${baseName()}.${ext}`); status(`Saved ${baseName()}.${ext}: ${n} frames, ${w} × ${h}, ${(blob.size / 1048576).toFixed(1)} MB, in ${Math.round((performance.now() - t0) / 1000)} s.`);
      window.ANIM3.last = blob;
    } catch (e) { if (vid) vid.close(); status(e.message === 'cancelled' ? 'Cancelled.' : 'Sorry, that did not work: ' + e.message); }
    finally { if (sess) sess.end(); busy = false; $('an-go').disabled = false; $('an-close').textContent = 'Close'; }
  };
})();
