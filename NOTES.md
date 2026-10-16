# 3DCraft – development notes

How 3DCraft is built and what to keep in mind when changing it. For what it does and how to use it, see [README.md](README.md).

## How it is built

- **No build step for the app.** `index.html` loads `fonts/fonts.css`, `css/base.css` (the shared Craft styles, own copy) and `css/3dcraft.css`, then `lib/craft3d-libs.js`, `fonts/fonts3d.js`, `js/craft-titlebar.js`, `js/fills.js`, `js/tracer.js`, `js/craft-symbols.js`, `js/scene.js`, `js/ui.js`, `js/timeline.js`, `js/animexport.js` and `js/range-type.js`.
- **The libraries** are one IIFE bundle (`lib/craft3d-libs.js`) so the app works from `file://` without modules: three.js 0.186 with OrbitControls, TransformControls, SVGLoader, GLTF/OBJ/STL loaders and exporters, RoomEnvironment, RoundedBoxGeometry and BufferGeometryUtils (as `window.THREE`), three-gpu-pathtracer's WebGLPathTracer, gifenc (`window.Gifenc`), webm-muxer and mp4-muxer (`window.WebMMuxer`, `window.MP4Muxer`), opentype.js (`window.opentype`) and ImageTracer (`window.ImageTracer`). To rebuild: `cd lib/build && npm install && npm run build` (`entry.js` lists what goes in).
- **Fonts:** `fetch_fonts.py` downloads the 3D fonts as TrueType (`fonts/3d/*.ttf`: opentype.js cannot read woff2) plus the interface font, writes each one again as a script (`fonts/3d/*.js`, the font as base64 in `window.CRAFT_FONT_DATA`, because a page opened from the folder (`file://`) cannot fetch files but can load scripts; `E3.loadFont` adds the script when a font is first needed), writes `fonts/fonts.css` (so the font menu shows each font) and `fonts/fonts3d.js` (`window.CRAFT_FONTS3D = [[family, group, { weight: file }]]`), and runs `make_symbols.py` for `fonts/symbols.js` (kept to the sets 3D can draw: Noto Sans Symbols 2 and the emoji).
- **Title bar, ribbon, fills, symbols picker and slider-typing helper** are own copies of the shared Craft pieces.

## Files

| File | What is in it |
| --- | --- |
| `js/scene.js` (`window.E3`) | The scene model, geometry and materials, building three.js objects from the model, one or four views, picking, the handles, middle-mouse dragging, the corner dial's maths, lights/background/ground, the camera, quick pictures (`renderImage`), ray-traced renders (`pathRender`), 3D files in and out. |
| `js/ui.js` | History and autosave, adding things, Layers, the Add and Symbols tabs, the properties panel (a small form builder), the corner dial's drawing and dragging, Picture to 3D, Export, Render, files, starter scenes, menus, ribbon, title bar, keyboard. |
| `js/timeline.js` (`window.TL3`) | The timeline panel: controls, ruler and playhead, layer rows with timer bars, property rows with stopwatches and keyframes, dragging keys and timers, easing menu, ready-made moves, camera moves, playback. |
| `js/animexport.js` (`window.ANIM3`) | Animation export: GIF (gifenc, a palette per frame), MP4 and WebM (WebCodecs VideoEncoder with the MP4 or WebM muxer), AVI (motion JPEG, written by hand: RIFF, `hdrl`, `movi`, `idx1`) and PNG frames in a stored .zip. |
| `js/tracer.js` (`window.CraftTracer`) | Picture to outlines, shared with LogoCraft (own copy in each app). |
| `js/fills.js` | The shared fill library (gradients, 33 patterns, pictures) and fill picker, as globals. |

## Model

- `doc = { app: '3DCraft', version, name, objects, scene, camera }`. `scene = { bg (a paint), ground, groundStyle ('floor' | 'shadow'), groundColor, shadow, light, lightPower, lightAngle, reflect }`, `camera = { pos, target, fov }`.
- Objects are a flat list with `parent` ids (groups): `{ id, name, kind: shape | text | trace | model | group, parent, visible, locked, pos, rot (degrees), scale, mat }`, plus `shape { type, sizes… }`, `text { text, font, bold, size, depth, bevel, spacing, align, lead }`, `trace { src, svg, colors, paths, mode, detail, smooth, removeBg, depth, stepped, ownColours, width, bevel }` or `model { format, data (base64), fit, keepOwn }`.
- `mat = { preset, color, metal, rough, coat, glass, glow, opacity, faces: { all | front | back | sides | top | bottom: paint } }`. Geometry groups carry the face names: boxes `[sides, sides, top, bottom, front, back]`, cylinders/cones/prisms/pyramids `[sides, top, bottom]`, extruded shapes (text, traced pictures, stars, hearts, flat rings) `[front, back, sides]` (`splitExtrude` splits the caps and gives them 0–1 picture coordinates over the outline). Face paints become `CanvasTexture`s drawn with `paintCanvas`.
- Objects are rebuilt from the model: `E3.rebuild()` (everything) or `E3.rebuildOne(id)`; moving only calls `E3.placeOne(id)`. The handles and the dial write positions back with `syncFromObject`.

## Things to know

- **Letters are drawn from their TrueType points** (`glyphPathData`), one letter at a time (so overlapping letters cannot cut holes in each other): opentype.js 2.0's own drawing gives NaN for some letters (Bungee's E). Lines are laid out with `forEachGlyph`, or plainly with kerning when a font uses a feature opentype.js stops on (`lineGlyphs`). Spacing leaves room for the bevel plus 2% of the size. Height scales letters by h up and 1/√h across.
- **Text outlines** come from opentype.js as SVG path data and are read with SVGLoader inside `<g transform="scale(1,-1)">`, so they face the right way before extruding (flipping afterwards turns faces inside out). Traced pictures are flipped the same way.
- **The tracer** finds the real colours itself (k-means with farthest-point starts on a nearest-pixel copy, leaving out clusters under 2.5%, which are only anti-aliased edges), snaps every pixel to them, and gives ImageTracer that palette; this avoids thin slivers along edges.
- **Material buttons** show a ball rendered in each material (`E3.materialPreview`: drawn with the main renderer in a corner of its canvas with a checked wall behind, copied to a PNG, cached). Presets also set `spec` (specular strength) and `sheen` so plastic, gloss, matte and rubber look different.
- **Materials** get the studio reflections as their own `envMap` (metals 1.5×, everything else 0.6×) so metals shine without washing out paint; imported GLB materials use `scene.environment`.
- **Views** are transparent `div`s over one WebGL canvas, drawn with scissor/viewport; each view's div is what OrbitControls and the TransformControls listen to, so handles work in any of the four views.
- **Quick pictures** (`renderImage`) and **ray-traced renders** (`pathRender`) use the main renderer at the asked size and then put it back. Ray-traced renders give the path tracer the studio room as a cube map, a "matte" shadow catcher when there is no floor (the floor catches shadows otherwise), and pause the editor (`E3.busy`).

## Testing

Headless Chrome over the DevTools protocol, opening `index.html` from the folder **without** `--allow-file-access-from-files` (that flag hides `file://` loading problems a normal double-click has): starter scenes, adding shapes, text, symbols and emoji, Picture to 3D on a drawn logo, a gradient on a face, the dial turning a selection, middle-mouse dragging, four views, picture export (see-through), GLB/OBJ/STL export and a ray-traced render.

## Animation

- `doc.anim = { length, fps, loop, tracks: { id: { start?, end?, keys: { pos | rot | scale | color | opacity: [{ t, v, ease }] } } }, camera: { move: none | turntable | swing, amount } }`.
- A property with keys follows them (`E3.valueAt`); without keys it stays at the object's own value (its rest pose: `m.pos`, `m.rot`, `m.scale`, `m.mat.color`, `m.mat.opacity`). `E3.setValue` is the one way to change these: an animated property gets a key at `E3.time`, others change the rest pose. The handles, the dial, middle-mouse dragging and the properties panel all go through it.
- `E3.evalAt(t)` puts every object (and the camera) where it is at time t, including the timers (`start`/`end` hide a layer outside its bar). Eases: linear, ease (cubic in-out), in, out, hold, bounce; a key's ease applies from it to the next key.
- The camera move rotates the saved camera around its target; `E3.camAngle` is taken back off when the camera is saved, so orbiting during a turntable does not drift.
- **Letter by letter:** `tracks[id].letters = { style, mode: in | out | both, start, leave, each, gap, order, amount, speed }` (styles in `E3.LETTER_STYLES`, each marked `in` or `loop`). A text with a letter animation is built as a group of one mesh per letter (`letterGroup`: `font.getPaths`, each letter's geometry centred on itself and placed back at its spot; cap picture coordinates use the whole word's outline box so pictures still run across the word). `evalAt` calls `poseLetters`, which works out each letter's offset, turn, size and opacity from its rank in the chosen order. Turning letters on or off rebuilds the object.
- **Camera keys:** `anim.camera.keys = [{ t, pos, target, fov, ease }]` (with the turntable or swing still added on top). `E3.camAt(t)` moves the target in a line and the camera round it in spherical coordinates. `evalAt(t, moveCamera)` only puts the keyed camera in place when the time changed or `moveCamera` is set (seeking, export frames), so looking around while editing is not undone by every change. `E3.setCamKey(t)` keeps the current view.
- Export: `E3.beginFrames(w, h)` sizes the renderer once; `frame(t)` evaluates and renders one frame; `end()` puts everything back.

