# 3DCraft – development notes

How 3DCraft is built and what to keep in mind when changing it. For what it does and how to use it, see [README.md](README.md).

## How it is built

- **No build step for the app.** `index.html` loads `fonts/fonts.css`, `css/base.css` (the shared Craft styles, own copy) and `css/3dcraft.css`, then `lib/craft3d-libs.js`, `fonts/fonts3d.js`, `js/craft-titlebar.js`, `js/fills.js`, `js/tracer.js`, `js/craft-symbols.js`, `js/scene.js`, `js/ui.js` and `js/range-type.js`.
- **The libraries** are one IIFE bundle (`lib/craft3d-libs.js`) so the app works from `file://` without modules: three.js 0.186 with OrbitControls, TransformControls, SVGLoader, GLTF/OBJ/STL loaders and exporters, RoomEnvironment, RoundedBoxGeometry and BufferGeometryUtils (as `window.THREE`), three-gpu-pathtracer's WebGLPathTracer, opentype.js (`window.opentype`) and ImageTracer (`window.ImageTracer`). To rebuild: `cd lib/build && npm install && npm run build` (`entry.js` lists what goes in).
- **Fonts:** `fetch_fonts.py` downloads the 3D fonts as TrueType (`fonts/3d/*.ttf`: opentype.js cannot read woff2) plus the interface font, writes `fonts/fonts.css` (so the font menu shows each font) and `fonts/fonts3d.js` (`window.CRAFT_FONTS3D = [[family, group, { weight: file }]]`), and runs `make_symbols.py` for `fonts/symbols.js` (kept to the sets 3D can draw: Noto Sans Symbols 2 and the emoji).
- **Title bar, ribbon, fills, symbols picker and slider-typing helper** are own copies of the shared Craft pieces.

## Files

| File | What is in it |
| --- | --- |
| `js/scene.js` (`window.E3`) | The scene model, geometry and materials, building three.js objects from the model, one or four views, picking, the handles, middle-mouse dragging, the corner dial's maths, lights/background/ground, the camera, quick pictures (`renderImage`), ray-traced renders (`pathRender`), 3D files in and out. |
| `js/ui.js` | History and autosave, adding things, Layers, the Add and Symbols tabs, the properties panel (a small form builder), the corner dial's drawing and dragging, Picture to 3D, Export, Render, files, starter scenes, menus, ribbon, title bar, keyboard. |
| `js/tracer.js` (`window.CraftTracer`) | Picture to outlines, shared with LogoCraft (own copy in each app). |
| `js/fills.js` | The shared fill library (gradients, 33 patterns, pictures) and fill picker, as globals. |

## Model

- `doc = { app: '3DCraft', version, name, objects, scene, camera }`. `scene = { bg (a paint), ground, groundStyle ('floor' | 'shadow'), groundColor, shadow, light, lightPower, lightAngle, reflect }`, `camera = { pos, target, fov }`.
- Objects are a flat list with `parent` ids (groups): `{ id, name, kind: shape | text | trace | model | group, parent, visible, locked, pos, rot (degrees), scale, mat }`, plus `shape { type, sizes… }`, `text { text, font, bold, size, depth, bevel, spacing, align, lead }`, `trace { src, svg, colors, paths, mode, detail, smooth, removeBg, depth, stepped, ownColours, width, bevel }` or `model { format, data (base64), fit, keepOwn }`.
- `mat = { preset, color, metal, rough, coat, glass, glow, opacity, faces: { all | front | back | sides | top | bottom: paint } }`. Geometry groups carry the face names: boxes `[sides, sides, top, bottom, front, back]`, cylinders/cones/prisms/pyramids `[sides, top, bottom]`, extruded shapes (text, traced pictures, stars, hearts, flat rings) `[front, back, sides]` (`splitExtrude` splits the caps and gives them 0–1 picture coordinates over the outline). Face paints become `CanvasTexture`s drawn with `paintCanvas`.
- Objects are rebuilt from the model: `E3.rebuild()` (everything) or `E3.rebuildOne(id)`; moving only calls `E3.placeOne(id)`. The handles and the dial write positions back with `syncFromObject`.

## Things to know

- **Text outlines** come from opentype.js as SVG path data and are read with SVGLoader inside `<g transform="scale(1,-1)">`, so they face the right way before extruding (flipping afterwards turns faces inside out). Traced pictures are flipped the same way.
- **The tracer** finds the real colours itself (k-means with farthest-point starts on a nearest-pixel copy, leaving out clusters under 2.5%, which are only anti-aliased edges), snaps every pixel to them, and gives ImageTracer that palette; this avoids thin slivers along edges.
- **Materials** get the studio reflections as their own `envMap` (metals 1.5×, everything else 0.6×) so metals shine without washing out paint; imported GLB materials use `scene.environment`.
- **Views** are transparent `div`s over one WebGL canvas, drawn with scissor/viewport; each view's div is what OrbitControls and the TransformControls listen to, so handles work in any of the four views.
- **Quick pictures** (`renderImage`) and **ray-traced renders** (`pathRender`) use the main renderer at the asked size and then put it back. Ray-traced renders give the path tracer the studio room as a cube map, a "matte" shadow catcher when there is no floor (the floor catches shadows otherwise), and pause the editor (`E3.busy`).

## Testing

Headless Chrome over the DevTools protocol: starter scenes, adding shapes, text, symbols and emoji, Picture to 3D on a drawn logo, a gradient on a face, the dial turning a selection, middle-mouse dragging, four views, picture export (see-through), GLB/OBJ/STL export and a ray-traced render.
