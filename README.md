<img src="docs/logo.svg" width="64" height="64" alt="3DCraft logo">

# 3DCraft

**3D titles, logos and scenes in your browser: shapes, 3D text, pictures turned into 3D, objects and scenery, layered backdrops and landscapes, materials, lights, animation with a timeline, ray-traced renders, and 3D models in and out.**

3DCraft brings back the easy 3D title and logo programs of the 1990s, rebuilt for today. Type a word and it stands up in 3D gold; drop a logo in and it is traced into colours and pulled out into a solid; pick plastic, chrome or glass; turn it all with the dial in the corner; then render a photo-real picture or save a model for a 3D printer. Everything works offline from this folder.

![The bouncing ball demo: a checkered ball bouncing and spinning in front of a grid, made in 3DCraft](docs/bouncing-ball.gif)

*The bouncing ball demo, made and exported as a GIF in 3DCraft: a nod to one of the first famous computer animation demos of the 1980s.*

![A shapes still life in the soft studio light](docs/still.png)

## Getting started

1. Download this repository (green **Code** button › **Download ZIP**) or clone it.
2. Double-click `index.html`. It opens in Chrome or Edge.
3. Pick a starter scene (3D title, retro chrome, shapes still life, glass and gold, the **test scene**, the **bouncing ball demo** (a retro checkered ball bouncing and spinning in front of a grid) or the **doll demo** (a rag doll with fur hair and a polka-dot dress who blinks, turns her head, waves, and holds a spinning rainbow pinwheel, with a flag flapping in the wind)) or an empty one. **Load test scene** (Home › Help) is a ready-made scene for trying everything: letters spinning in and waving, glass, chrome, gold, copper, glow, plastic, matte and rubber, a gradient on a face, the checkered ball bouncing behind the title, a TV with colour bars scrolling down its screen, ready-made moves, and the camera going all the way round; everything ends where it began, so it loops seamlessly. It starts playing straight away.
4. Add things, change them, then **Render** or **Export**.

Your scene autosaves in the browser; **Save** keeps a `.3dcraft.json` file (pictures and models are kept inside it).

## What it does

### Building

- **Shapes:** box, rounded box, sphere, cylinder, cone, pyramid, prism (3 to 24 sides), doughnut, flat ring, capsule, star (any number of points), heart and flat panel, each with its own sizes.
- **Stage** to stand things on: round, oval, square, rectangle, hexagon or octagon; width, depth and height; corners from sharp to round; a rounded rim; 1 to 6 **steps** (a podium) and how far each comes in. Give its top, sides and bottom their own colour, gradient, pattern or picture, and stretch it to distort it.
- **Objects** (Insert › Objects, or the Add tab), each made of parts that can have their own colour, picture or pattern: **palm tree** (height, lean, leaves, coconuts); **tables** with a round, square or rectangle top on one centre leg with feet out to four sides, or on four legs; a **computer monitor** (ultra-thin, on a stand); **flat TVs** (43 and 65 inch, any size); a **CRT TV**; and an original little **test boat**. Put a picture on a monitor's or TV's **screen** and it lights up like a real screen.
![Objects and scenery: a stage with a TV showing a picture, a palm tree, lighthouse, sailboat, cactus, mushroom, rocket, table, pine tree, traffic cone and microchip](docs/objects.png)

- **Scenery objects** to go with the backdrops (Add tab › Scenery, or **Add matching objects** on the Backdrop tab): rock, asteroid, crater, rocket, flying saucer, sailboat, lighthouse, beach umbrella, microchip, capacitor, street lamp, bench, traffic cone, pine tree, tree stump, mushroom, cactus, bush, fence and a **flag** whose cloth flaps in the wind (strength and speed), each with its own parts and colours (rocks, asteroids, cacti and bushes take a shape number for a different one).
- **3D text** in 42 fonts (bold and blocky, clean, classic, script, techno and retro), with depth, rounded edges (bevel), letter spacing (letters keep a little apart, and only touch when you turn it below zero), **height** (from short and fat to tall and thin), several lines and alignment.
- **Picture to 3D:** drop a logo or drawing on the view (or Insert › Picture to 3D). It is traced into clean outlines in a few colours (**Best match** finds how many, or choose 2 to 16), with detail and smoothing, and the background left out; each colour is pulled out into 3D, flat or **stepped** (each colour at a different height), in the picture's own colours or a material of your choice.
- **Clean up the picture first** (Picture to 3D and Photos to 3D): pick the best of four background removals side by side (Whole picture, Gentle, Normal, Strong; only background touching the outside goes, so white details inside stay), fine-tune the tolerance, then touch it up on the preview with Photoshop-style tools: **Magic wand** (click an area to take it out), **Eraser** and **Restore** brushes, **✂ Trim** (click points round what to keep: everything outside goes) and **Lasso cut** (click points round something to take out), **Invert** (what was taken out comes back and the rest goes: mark what to keep, then invert), and **Show the mask** to see what will go in red over your picture while you try things, with Undo and Start again.
- **Photos to 3D** (Insert tab, Add tab, Insert menu), made into a coloured mesh you can light, animate, render or save as STL/OBJ for printing:
  - **One photo (a guess):** something on a plain background is cut out and raised into a 3D shape: choose the **edge shape** (Round, Angled, Square or Puffy), how far the edge **reaches in** (just the outside, for a flat top like a badge or cookie, up to the whole shape, fully domed), the **thickness**, some of the photo's shading as bumps, and a flat back for a printer's bed.
  - **Turntable photos:** 12 to 36 photos of an object turned evenly on a turntable (camera kept still, plain background) are carved into its shape from every angle and painted with the photos. Deep hollows can't be seen from outside.
- **Photo cut-out:** any picture or photo cut out round its shape (by its see-through parts, or a plain background removed with a tolerance) and made into a solid with the photo on the front and back, a thickness, rounded edges and an emboss (Relief). Animate it, render it, or save it as GLB, OBJ or STL.
- **3D symbols and emoji:** the Symbols tab puts dingbats (Noto Sans Symbols 2) and emoji (Noto Emoji) into the scene as solid 3D shapes.
- **3D models and scans in:** GLB, GLTF, OBJ, STL and **PLY**, kept inside the scene file. Scans from photogrammetry apps come in with their colours: a PLY mesh or point cloud with a colour on every point, or an OBJ chosen (or dropped) together with its **MTL and texture pictures**. Then size, light, animate and render them, or save them again as STL or OBJ for printing.

![Picture to 3D: a logo traced into colours](docs/picture-to-3d.png)

### Materials

Plastic, glossy paint, matte, gold, silver, chrome, copper, glass, glow, **water** (clear and blue with ripples that drift when the animation plays; try it on a stage for a pool) and rubber, then colour, shine, metal, glass (see-through), glow and opacity. Put a **picture, gradient, pattern or colour on every face, or only on the front, back, sides, top or bottom** (shapes and 3D text have their own faces). Gradients and the 33 patterns are the same as in the other Craft apps. **Fabrics:** cotton, denim, velvet, silk and felt, with a weave pressed into the surface (plain, twill, knit or satin), weave size, sheen (the soft glow of cloth) and softness. **Fur or hair** on anything: length, thickness, a lighter tip colour and droop. **Relief (emboss)** raises the light parts of any picture, pattern or gradient on a face (or the dark parts) so it catches the light like embossed card or carved stone, from flat to 300%, in the view and in ray-traced renders. **Colour cycling** makes bands of colour scroll through an object while the animation plays, like the moving colours of old computer logos: retro 8-bit bands, smooth rainbow, sunset glow (a smooth orange, pink and purple flow), shaded rainbow bars (each bar lit like a rounded chrome strip), fire, ocean, neon, gold shimmer or copper bars, with speed, number of bands and direction (up, down, up and down, left, right, side to side); on a monitor or TV it plays on the screen only (on 3D text, the front only if you like).

### Moving and turning

- Click something, then drag its **arrows** (move, W), **rings** (turn, E) or **boxes** (size, R), or type exact numbers on the right.
- **Hold the middle mouse button on an object to drag it** (it slides in the plane facing you). Over empty space the middle button slides the view.
- **The dial in the corner** stays put: drag a coloured ring to turn around X, Y or Z, drag the ball to turn freely, click a letter to look along that axis, double-click the ball to reset. It turns **All** (the whole scene) or only the **Selected** object.
- **Layers:** hide, lock, rename, reorder and group; the view: one big view or **four views** (top, front, right, 3D).

![Four views](docs/four-views.png)

### Backdrop

![A sunset countryside backdrop in the Modern style behind a gold title](docs/backdrop.png)

Scenery in layers behind your scene, like the flats of a stage or the layers of an old video game (the **Backdrop** tab on the left, and on the ribbon):
- **Choose a backdrop:** Countryside, City, Seaside, Ocean and islands, Desert, Night city, Playground, Computer, Rainbow meadow, Balloon festival, Space, Open woodland, Pine forest (USA), Woodland (UK) or Rainforest (Amazon) (click again for another one), or **🎲 Surprise me**; **🎲 Shuffle shapes** keeps the layers and gives them new shapes.
- Layers: **sun or moon, stars, clouds, mountains, hills, treeline, city skyline** (lit windows at sunset and night), **sea, islands** (with palms), **playground** (swings, slide, climbing frame, seesaw, fence), **circuit board** (chips and glowing traces), **forest** (open woodland with big trees, pines, oaks, rainforest with umbrella-crowned giants, palms and vines, or ferns; with a density slider), and in the sky **floating pixels, birds, hot-air balloons, a rainbow and planets**.
- **Your own picture** as a layer: cut out by its see-through parts or a plain background, with a drop shadow, an embossed edge and an optional white die-cut border; it can repeat along the layer and scroll, and stands on a fold-out stand in Cardboard. Add, hide, reorder and delete them; each has its own height, haze, colour and shape.
- Three styles, for the whole backdrop or one layer: **Classic** (flat cut-outs with an embossed edge and a drop shadow), **Modern** (soft rounded 3D) and **Cardboard** (cut-outs with cardboard edges, propped up by fold-out stands, clouds on sticks; the stands can be hidden).
- **Detail level** (Simple, Normal, High, Extra), all made from the seed: finer mountain ridges, snow caps and shaded slopes, rooftops (water towers, spires, boxes) and shaded sides on the city, bushes and rocks on the hills, fuller clouds. **Planets** are textured worlds (banded gas giants, cratered rock, icy, and blue worlds with land and clouds), real spheres in Modern and Cardboard, with banded rings.
- **Palettes:** Day, Sunset, Night, Desert, Storm, Digital and Rainforest mist, which also set the sky; farther layers come out hazier.
- **Sun and moon** in detail (a glowing mottled sun with a corona and rays; a cratered moon with seas and a phase), and a **Sky traffic** layer: airliners with contrails, spaceships, airships and shooting stars crossing the far sky, timed to loop with the animation.
- **Matching ground** that takes the place of the plain floor and fades into the front layer of scenery, so they meet without a line: grass, grass with flowers, forest floor, sand, a beach with reflective rippling water beyond, paving, grass with a play surface, a neon grid or rocky ground. Automatic picks it from the backdrop; the beach or play area size can be set.
- Everything stands on the ground (nothing hangs below the horizon). All layers stand 75 to 100 units out and stay behind your scene from wherever the camera looks; raise or lower it all to meet the horizon.
- **Movement:** scroll speed (endless loop or pass by once) with nearer layers faster for depth, bobbing, and per layer **fly in, rise up or slide in**, and out again, at chosen times.

### Ground

The floor and the land round your scene and out to the horizon, all in one place (the **Ground** tab: **None**, **Shadow only**, **Plain floor** or **Landscape**, with floor colour, shadow strength and the grid, separate from the Backdrop and the Scene, with quick switches on the Backdrop ribbon tab: **Landscape ground**, **Terrain** and **Eye candy**; terrain and eye candy start off, so scenes stay light and quick to render): turn the landscape ground on or off (the backdrop stays as it is); what it is made of (automatic from the backdrop, or grass, flowers, forest floor, sand, beach and water, paving, play surface, neon grid, rock); **terrain** (flat, gentle rolling, hills or dunes, with height and how big a flat area stays round the scene); **filler** for depth: grass fuzz, flowers, rocks, pebbles and shrubs, thinning out towards the scene, with a new layout at a click or **Match the backdrop**; and **distance haze** so far things fade into the sky. Choosing a backdrop sets up land that suits it.

![The Ground tab: terrain and eye candy in a pine forest](docs/ground.png)

### Scene

Ground (none, shadow only, or a floor in any colour), lights (studio, sunset, night, dramatic, soft) with brightness and direction, reflections, and the camera lens.

![Retro chrome](docs/chrome.png)

### Render and export

- **Render now** (title bar, next to Search) starts a ray-traced picture of the scene straight away, at the size and quality last chosen.
- **Render (ray-traced)** (F9): light bounces like real light, for true reflections, soft shadows and glass that bends light. Pick a size (from a quick 640 × 360 look to 4K and print sizes) and a quality (**Draft, Good, High, Best**: 24 to 1000 samples). The picture clears up as you watch; stop any time and keep it. **Smooth the grain** (Off, Light, Medium or Strong; Medium to start) cleans up graininess while keeping edges and pictures sharp; change it after rendering to compare, without rendering again. **Edges (anti-aliasing):** normal, or 2×, 3× or 4× smoother (renders that much bigger and shrinks it; slower). See-through background too. Save PNG or JPG.
- **Export:** a quick picture of the view (PNG or JPG, up to 4K or print sizes, see-through if you like), or the 3D model as **GLB** (with colours), **OBJ** or **STL** (for 3D printing), all or only the selected object.

![The Render window](docs/render.png)

![The test scene: letters spinning in, every material, moves and a camera move](docs/test-scene.png)

## Keyboard shortcuts

| Keys | What they do |
| --- | --- |
| Ctrl+N / O / S | New / open / save |
| Ctrl+E / F9 | Export / Render |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+C / V / D | Copy / paste / duplicate |
| Delete | Delete |
| W / E / R | Move / turn / size |
| F | See everything |
| 1 / 3 / 7 / 5 | Front / right / top / ¾ view |
| Space / Home / End | Play or pause / start / end |
| , / . | One frame back / on |
| Ctrl+G | Group |
| Esc | Deselect |
| Alt+Q / F10 | Search commands / all menus |

### Animation

![The timeline: layers with timer bars, properties with stopwatches and keyframes](docs/animate.png)

The **Timeline** under the 3D view works like a motion-graphics timeline:
- Each layer has a **timer bar**: drag its ends to set when it appears and disappears, or drag the middle to slide it.
- Twirl a layer open (▸) for **Position, Turn, Size, Colour and Opacity**. Click a **stopwatch** to animate one: from then on, moving, turning or sizing the object (with the handles, the dial, middle-mouse dragging or the numbers) makes a **keyframe** ◆ at the current time. ◆ adds or removes a keyframe at the current time.
- **Drag keyframes** to retime them; **double-click** one for how it moves on: linear, ease, ease in, ease out, hold or bounce. Delete removes the selected keyframe.
- **Letter by letter** for 3D text: the letters come in, go out, or keep moving one after another: typewriter, fade, drop in (with a bounce), rise up, grow, spin, flip, slide, scatter (fly together), wave, jump, rock and colour sweep. Choose how long each letter takes, how soon the next one starts, the order (first to last, last to first, middle out, ends in, random) and how far they move. A **Letters** row on the timeline shows when, and can be dragged.
- **Ready-made moves** for the selected object: spin, flip, bounce, fly in, rise up, fade in, fade out, grow in, pulse, float, wobble and colour cycle. The **camera** can stay still, go round on a **turntable** or **swing** to and fro, by any number of degrees and **from** any angle (where the turn begins, so a loop can start from the view you choose).
- **Camera keyframes:** look around in the view, then click ◆ on the **Camera** row to keep that view at the playhead; the camera swings smoothly from one kept view to the next (with the same eases). Ready-made camera moves: **push in, pull back, crane up, fly round and in**. You can still look around freely while working; the keyed camera takes over when you play or scrub, and clicking a camera keyframe shows that view.
- **Play** (Space), back to the start (Home), to the end (End), one frame back or on (, and .), **loop**, and drag the playhead to scrub. Set the length (up to 2 minutes) and 12 to 60 frames a second.
- **Export the animation** as an animated **GIF** (loops, see-through if you like), **MP4** (H.264), **WebM** (VP9), **AVI** (motion JPEG, the classic way) or a .zip of numbered **PNG frames**, from 480 × 270 up to 4K, square or upright for phones. Frames are drawn one at a time at exact times, so the result is smooth on any computer. Choose **Look: Ray-traced** (Draft, Good or High) and every frame is path-traced and smoothed, with real reflections, glass and soft shadows; the first frame takes longest while the ray tracer gets ready (up to half a minute), then each frame takes about a second at Draft on a typical graphics card, with a time-left estimate and Cancel.

## Requirements

A current Chrome, Edge or Firefox with WebGL 2. Ray-traced renders are much faster with a graphics card.

## How this was made

This app is **vibe coded**: its author designed and directed it in plain conversation, feature by feature, and an AI coding assistant (Claude, by Anthropic) wrote the code.

It is a **genuine clean-room build**, not a decompiled or AI-rebuilt copy of anything:
- Nothing was decompiled, disassembled or reverse-engineered, in whole or in part.
- No code, artwork, fonts, icons or data files from any original program were used, and none were given to the AI to work from.
- 3DCraft is inspired by the 3D title and logo programs of the 1990s (such as Asymetrix Web 3D and 3D F/X), and its timeline by motion-graphics tools; only publicly known features and general ideas guided the design. Every line of code and every starter scene here was made new.

Open-source libraries it uses are listed with their licences in Credits.

## Credits

- [three.js](https://threejs.org) 0.186 (MIT) for 3D, with its add-ons for controls, loaders (GLTF, OBJ, MTL, STL, PLY) and exporters.
- [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) and [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (MIT) for ray-traced renders.
- [opentype.js](https://opentype.js.org) (MIT) for 3D text from fonts.
- [gifenc](https://github.com/mattdesl/gifenc), [webm-muxer](https://github.com/Vanilagy/webm-muxer) and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT) for animated GIF, WebM and MP4.
- [ImageTracer](https://github.com/jankovicsandras/imagetracerjs) (public domain) for tracing pictures.
- Fonts from Google Fonts under the SIL Open Font License or the Apache License, stored in `fonts/` (run `python fetch_fonts.py` to download them again).
- Emoji and symbol names from Unicode data (Unicode License).

## Development notes

How 3DCraft is built is described in [NOTES.md](NOTES.md).
