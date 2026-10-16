"""Downloads 3DCraft's fonts from Google Fonts into fonts/ so the app works offline.

3D text is built from the letter outlines, so the 3D fonts are TrueType files (fonts/3d/*.ttf, Latin, plus the
symbols font for 3D dingbats). The interface font is a woff2 file in fonts/fonts.css.
fonts/fonts3d.js lists the 3D fonts for the menus. All fonts are SIL Open Font License or Apache License.

Run:  python fetch_fonts.py
"""
import base64, json
import pathlib
import re
import urllib.request

# [family, group, weights]
FONTS3D = [
    *[(f, 'Bold and blocky', ['400']) for f in ['Archivo Black', 'Anton', 'Bebas Neue', 'Bungee', 'Alfa Slab One', 'Black Ops One', 'Russo One', 'Ultra',
        'Sigmar', 'Rubik Mono One', 'Luckiest Guy', 'Bangers', 'Shrikhand']],
    *[(f, 'Clean', ['400', '700']) for f in ['Montserrat', 'Poppins', 'Oswald', 'Roboto Slab', 'Fredoka', 'Comfortaa']],
    *[(f, 'Classic', ['400', '700']) for f in ['Playfair Display', 'Merriweather', 'Cinzel']],
    *[(f, 'Classic', ['400']) for f in ['Abril Fatface', 'Rye', 'UnifrakturMaguntia']],
    *[(f, 'Script', ['400']) for f in ['Lobster', 'Pacifico', 'Great Vibes', 'Permanent Marker', 'Dancing Script']],
    *[(f, 'Techno and retro', ['400']) for f in ['Orbitron', 'Audiowide', 'Righteous', 'Press Start 2P', 'Silkscreen', 'Bitcount Single', 'Monoton', 'Creepster', 'Fascinate', 'Special Elite']],
    ('Noto Sans Symbols 2', 'Symbols', ['400']),
    ('Noto Emoji', 'Symbols', ['400']),
]
UI_CSS = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap"
OLD_UA = "Mozilla/4.0"  # Google Fonts sends TrueType to old browsers
NEW_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
root = pathlib.Path(__file__).parent
out = root / "fonts"; (out / "3d").mkdir(parents=True, exist_ok=True)


def get(url, ua):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": ua}), timeout=60).read()


listing = []
for family, group, weights in FONTS3D:
    files = {}
    for w in weights:
        css = get(f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wght@{w}", OLD_UA).decode("utf-8")
        urls = re.findall(r"url\((https://[^)]+\.ttf)\)", css)
        if not urls:
            print("no TrueType for", family, w); continue
        name = f"{family.replace(' ', '')}-{w}.ttf"
        (out / "3d" / name).write_bytes(get(urls[0], OLD_UA))
        # the same font as a script: pages opened from the folder (file://) cannot fetch files, but they can load scripts
        b64 = base64.b64encode((out / "3d" / name).read_bytes()).decode("ascii")
        (out / "3d" / name.replace(".ttf", ".js")).write_text("/* %s as text, so 3D text works when index.html is opened from the folder (file://). */\n(window.CRAFT_FONT_DATA = window.CRAFT_FONT_DATA || {})[%r] = '%s';\n" % (name, "3d/" + name, b64), encoding="ascii")
        files[w] = "3d/" + name
    if files:
        listing.append([family, group, files])
        print("ok", family)
# the interface font (woff2)
css = get(UI_CSS, NEW_UA).decode("utf-8"); rules = []
for subset, block in re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S):
    if subset not in ("latin", "latin-ext"):
        continue
    url = re.search(r"url\((https://[^)]+)\)", block).group(1); w = re.search(r"font-weight: ([\d ]+);", block).group(1)
    name = f"InstrumentSans-{w.replace(' ', '-')}-{subset}.woff2"; (out / name).write_bytes(get(url, NEW_UA)); rules.append(block.replace(url, name))
# the 3D fonts also load as web fonts, so the font menu shows each name in its own letters
for family, group, files in listing:
    rules.append("@font-face { font-family: '%s'; src: url(%s) format('truetype'); font-weight: 400; }" % (family, files.get('400') or list(files.values())[0]))
(out / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
(out / "fonts3d.js").write_text("/* The fonts for 3D text (written by fetch_fonts.py): [family, group, { weight: file }]. */\nwindow.CRAFT_FONTS3D = " + json.dumps(listing) + ";\n", encoding="utf-8")
# the Symbols picker's data, for 3D dingbats and 3D emoji (the sets 3D can use: no knitting fonts here)
try:
    import importlib.util, json as _j, sys as _s
    spec = importlib.util.spec_from_file_location("make_symbols", root / "make_symbols.py")
    if spec and (root / "make_symbols.py").exists():
        _s.argv = [_s.argv[0], str(root)]; spec.loader.exec_module(importlib.util.module_from_spec(spec))
        f = out / "symbols.js"; t = f.read_text(encoding="utf-8"); head, data = t.split("window.CRAFT_SYMBOLS = ", 1)
        d = _j.loads(data.rstrip().rstrip(";")); d["sets"] = [x for x in d["sets"] if x["font"] in ("Noto Sans Symbols 2",)]
        f.write_text(head + "window.CRAFT_SYMBOLS = " + _j.dumps(d, ensure_ascii=False) + ";\n", encoding="utf-8")
except Exception as e:
    print("fonts/symbols.js not rebuilt:", e)
print(f"{len(listing)} 3D fonts")
