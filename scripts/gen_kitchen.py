#!/usr/bin/env python3
"""
gen_kitchen.py — Generate kitchen backgrounds (west & flat) for Kuro EP1
S2: SVG vector drawing  →  S3: bake PNG  →  S4: light form SVGs
Run from repo root: python3 scripts/gen_kitchen.py
"""

import json, os
from pathlib import Path
import cairosvg
from PIL import Image
from collections import Counter

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT   = Path(__file__).parent.parent
PAL_F  = ROOT / 'palette.json'
MAN_F  = ROOT / 'manifests' / 'bg-kitchen.json'
OUT    = ROOT / 'assets' / 'bg'
OUT.mkdir(parents=True, exist_ok=True)

# ── load data ─────────────────────────────────────────────────────────────────
with open(PAL_F) as f:
    pal = json.load(f)

with open(MAN_F) as f:
    man = json.load(f)

C = {}
for grp in ('warm', 'neutral', 'cool', 'character'):
    for name, info in pal[grp].items():
        C[name] = info['hex']

W, H = man['canvas']['w'], man['canvas']['h']   # 1280 × 720

# ── SVG primitives ────────────────────────────────────────────────────────────

def R(x, y, w, h, fill):
    """Solid rectangle."""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{C[fill]}"/>'

def P(pts, fill, opacity=1.0):
    """Polygon."""
    s = ' '.join(f'{x},{y}' for x, y in pts)
    op = f' opacity="{opacity}"' if opacity < 1.0 else ''
    return f'<polygon points="{s}" fill="{C[fill]}"{op}/>'

def L(x1, y1, x2, y2, stroke, sw=2):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{C[stroke]}" stroke-width="{sw}"/>'

def wrap(body, w=W, h=H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            + body + '\n</svg>')

def save_svg(path, body, w=W, h=H):
    path = Path(path)
    path.write_text(wrap(body, w, h))
    print(f'  SVG → {path.relative_to(ROOT)}')

def svg_to_png(svg_path, png_path):
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path),
                     output_width=W, output_height=H)
    img = Image.open(png_path)
    actual = img.size
    print(f'  PNG → {Path(png_path).relative_to(ROOT)}  size={actual[0]}×{actual[1]}')
    return actual

# ── Kitchen geometry constants ─────────────────────────────────────────────────
# Derived from manifest; all values listed here so verification is trivial.

CEIL_H    = 100   # ceiling band y=0..100
WALL_TOP  = 100
WIN_L, WIN_R, WIN_T, WIN_B = 60, 320, 110, 440
CAB_TOP, CAB_BOT           = 110, 300   # upper cabinet top/bottom
CTR_TOP, CTR_BOT           = 440, 540   # counter top/bottom
FLOOR_TOP = 540
GND_Y     = 620
FRG_L, FRG_R, FRG_T       = 960, 1180, 190   # fridge

# ── S2: base kitchen SVG (no light forms) ─────────────────────────────────────

def build_kitchen_base() -> str:
    els = []

    # ── FULL-CANVAS BASE (prevents transparent/black holes) ───────────────────
    els.append(R(0, 0, W, H, 'cream_wall'))

    # ── CEILING ───────────────────────────────────────────────────────────────
    els.append(R(0, 0, W, CEIL_H, 'cream_wall'))
    # ceiling/wall shadow seam
    els.append(R(0, CEIL_H - 8, W, 8, 'ash_dark'))
    # top-left corner deep
    els.append(R(0, 0, 60, CEIL_H, 'slate_deep'))
    # top-right corner
    els.append(R(1200, 0, 80, CEIL_H, 'ash_dark'))

    # ── UPPER WALL ────────────────────────────────────────────────────────────
    els.append(R(0, WALL_TOP, W, CTR_TOP - WALL_TOP, 'cream_wall'))
    # left edge deep shadow (no window here)
    els.append(R(0, WALL_TOP, 60, CTR_TOP - WALL_TOP, 'indigo_shadow'))
    # right wall shadow gradient (3 bands)
    els.append(R(1180, WALL_TOP, W - 1180, CTR_TOP - WALL_TOP, 'lavender_soft'))
    els.append(R(1215, WALL_TOP, W - 1215, CTR_TOP - WALL_TOP, 'violet_mid'))
    els.append(R(1248, WALL_TOP, W - 1248, CTR_TOP - WALL_TOP, 'indigo_shadow'))

    # ── WINDOW ────────────────────────────────────────────────────────────────
    # glass / sky
    els.append(R(WIN_L, WIN_T, WIN_R - WIN_L, WIN_B - WIN_T, 'sun_bright'))
    # warm amber at base of window (low sun entry)
    els.append(R(WIN_L, WIN_T + 240, WIN_R - WIN_L, 90, 'amber_mid'))
    # frame bars
    els.append(R(WIN_L - 3, WIN_T - 3, WIN_R - WIN_L + 6, 8, 'ash_dark'))   # top
    els.append(R(WIN_L - 3, WIN_B - 2, WIN_R - WIN_L + 6, 8, 'ash_dark'))   # bottom
    els.append(R(WIN_L - 3, WIN_T - 3, 8, WIN_B - WIN_T + 6, 'ash_dark'))   # left
    els.append(R(WIN_R - 2, WIN_T - 3, 8, WIN_B - WIN_T + 6, 'ash_dark'))   # right
    # cross bars
    els.append(R(WIN_L, WIN_T + 158, WIN_R - WIN_L, 6, 'ash_dark'))          # H-bar
    els.append(R(WIN_L + 127, WIN_T, 6, WIN_B - WIN_T, 'ash_dark'))          # V-bar
    # sill
    els.append(R(WIN_L - 3, WIN_B - 2, WIN_R - WIN_L + 6, 14, 'stone_light'))

    # ── UPPER CABINETS (right of window) ──────────────────────────────────────
    els.append(R(WIN_R, CAB_TOP, 400, CAB_BOT - CAB_TOP, 'stone_mid'))
    # 3 cabinet doors
    for i, dx in enumerate([330, 460, 588]):
        dw = 122 if i < 2 else 124
        els.append(R(dx, CAB_TOP + 8, dw, CAB_BOT - CAB_TOP - 10, 'stone_light'))
        # inner inset panel
        els.append(R(dx + 8, CAB_TOP + 16, dw - 16, CAB_BOT - CAB_TOP - 26, 'stone_mid'))
    # door dividers + bottom rail
    els.append(R(456, CAB_TOP, 4, CAB_BOT - CAB_TOP, 'ash_dark'))
    els.append(R(584, CAB_TOP, 4, CAB_BOT - CAB_TOP, 'ash_dark'))
    els.append(R(WIN_R, CAB_BOT - 8, 400, 8, 'ash_dark'))

    # ── WALL BETWEEN CABINETS AND FRIDGE ──────────────────────────────────────
    # Open-kitchen wall section (x=720..960, y=100..440)
    els.append(R(720, WALL_TOP, FRG_L - 720, CTR_TOP - WALL_TOP, 'cream_wall'))
    # left shadow seam at cabinet edge
    els.append(R(718, WALL_TOP, 5, CTR_TOP - WALL_TOP, 'ash_dark'))

    # ── COUNTER + CABINETS BASE ────────────────────────────────────────────────
    # counter body
    els.append(R(0, CTR_TOP, 720, CTR_BOT - CTR_TOP, 'stone_mid'))
    # counter top surface
    els.append(R(0, CTR_TOP, 720, 12, 'stone_light'))
    # wooden base cabinet doors (left section)
    for dx in [8, 136, 264]:
        els.append(R(dx, CTR_TOP + 14, 120, 72, 'sienna_deep'))
        els.append(R(dx + 8, CTR_TOP + 22, 104, 56, 'ash_dark'))
    # sink basin
    els.append(R(370, CTR_TOP + 14, 180, 74, 'slate_deep'))
    els.append(R(374, CTR_TOP + 14, 172, 4, 'stone_light'))   # rim highlight
    # faucet
    els.append(R(446, CTR_TOP + 6, 28, 10, 'ash_dark'))
    els.append(R(456, CTR_TOP - 8, 8, 16, 'ash_dark'))
    # right counter section (no sink)
    for dx in [560, 632]:
        els.append(R(dx, CTR_TOP + 14, 60, 72, 'stone_light'))
        els.append(R(dx + 6, CTR_TOP + 20, 48, 60, 'stone_mid'))
    # toe-kick
    els.append(R(0, CTR_BOT - 8, 720, 8, 'slate_deep'))

    # ── RIGHT WALL STRIP AT COUNTER LEVEL (x=1180..1280, y=440..540) ──────────
    els.append(R(1180, CTR_TOP, W - 1180, CTR_BOT - CTR_TOP, 'ash_dark'))
    els.append(R(1215, CTR_TOP, W - 1215, CTR_BOT - CTR_TOP, 'slate_deep'))

    # ── OPEN SPACE / SMALL APPLIANCE AREA (x=720..FRG_L) ──────────────────────
    # Small range/stove at x=720..860
    els.append(R(720, CTR_TOP, 140, CTR_BOT - CTR_TOP, 'ash_dark'))
    els.append(R(720, CTR_TOP, 140, 12, 'stone_mid'))   # stove top
    # burner squares
    for bx in [742, 812]:
        els.append(R(bx, CTR_TOP + 18, 28, 24, 'stone_mid'))
        els.append(R(bx + 8, CTR_TOP + 26, 12, 10, 'ash_dark'))
    # wall panel between stove and fridge
    els.append(R(860, CTR_TOP, FRG_L - 860, CTR_BOT - CTR_TOP, 'stone_mid'))

    # ── REFRIGERATOR ─────────────────────────────────────────────────────────
    # body
    els.append(R(FRG_L, FRG_T, FRG_R - FRG_L, H - FRG_T, 'stone_mid'))
    # vent strip at top
    els.append(R(FRG_L, FRG_T, FRG_R - FRG_L, 16, 'ash_dark'))
    # upper door
    els.append(R(FRG_L + 7, FRG_T + 16, FRG_R - FRG_L - 14, 284, 'stone_light'))
    # door seam
    els.append(R(FRG_L, FRG_T + 300, FRG_R - FRG_L, 8, 'ash_dark'))
    # lower door
    els.append(R(FRG_L + 7, FRG_T + 308, FRG_R - FRG_L - 14, H - FRG_T - 308, 'stone_light'))
    # handle upper (right side)
    els.append(R(FRG_R - 19, FRG_T + 70, 14, 80, 'ash_dark'))
    # handle lower
    els.append(R(FRG_R - 19, FRG_T + 318, 14, 55, 'ash_dark'))
    # left-side shadow
    els.append(R(FRG_L, FRG_T, 6, H - FRG_T, 'ash_dark'))
    # right-side light reflection
    els.append(R(FRG_R - 6, FRG_T, 6, H - FRG_T, 'stone_light'))
    # subtle cyan accent row (pre-baked hint of glow warmup)
    els.append(R(FRG_L + 7, FRG_T + 16, 4, 284, 'cyan_teal'))

    # ── FLOOR ────────────────────────────────────────────────────────────────
    # base tile color
    els.append(R(0, FLOOR_TOP, W, H - FLOOR_TOP, 'stone_light'))
    # horizontal grout lines
    for gy in range(FLOOR_TOP, H + 1, 62):
        els.append(R(0, gy, W, 2, 'stone_mid'))
    # vertical grout lines every 80px
    for gx in range(0, W + 1, 80):
        els.append(R(gx, FLOOR_TOP, 2, H - FLOOR_TOP, 'stone_mid'))
    # floor edge shadows (left)
    els.append(R(0, FLOOR_TOP, 55, H - FLOOR_TOP, 'ash_dark'))
    els.append(R(0, FLOOR_TOP, 20, H - FLOOR_TOP, 'indigo_shadow'))
    # floor edge shadows (right)
    els.append(R(1210, FLOOR_TOP, 70, H - FLOOR_TOP, 'ash_dark'))
    els.append(R(1240, FLOOR_TOP, 40, H - FLOOR_TOP, 'indigo_shadow'))
    # base-of-counter floor shadow strip
    els.append(R(0, FLOOR_TOP, 720, 10, 'ash_dark'))
    # fridge base shadow
    els.append(R(FRG_L, FLOOR_TOP, FRG_R - FRG_L, 10, 'slate_deep'))

    return '\n'.join(els)

# ── Light-form SVGs (S4) ───────────────────────────────────────────────────────

def make_light_polygon(frame: dict, out_path: Path):
    """Semi-transparent warm amber polygon = sunlit zone overlay."""
    pts = frame['polygon']
    els = [P(pts, 'amber_mid', opacity=0.55)]
    # bright core (inner inset of polygon by ~30px — approximate)
    save_svg(out_path, '\n'.join(els))

def make_curtain_band(frame: dict, out_path: Path):
    """Semi-transparent indigo polygon = curtain shadow overlay."""
    pts = frame['polygon']
    els = [P(pts, 'indigo_shadow', opacity=0.62)]
    save_svg(out_path, '\n'.join(els))

# ── Color verification (S5 partial) ───────────────────────────────────────────

def verify_colors(png_path: Path) -> dict:
    WHITELIST = set()
    for grp in ('warm', 'neutral', 'cool'):
        for info in pal[grp].values():
            WHITELIST.add(info['hex'].upper())
    FORBIDDEN = pal['character']['kuro_black']['hex'].upper()

    img = Image.open(png_path).convert('RGB')
    colors = Counter(img.getdata())
    violations = []
    for (r, g, b), n in colors.items():
        hx = '#%02X%02X%02X' % (r, g, b)
        if hx not in WHITELIST:
            tag = 'FORBIDDEN-BLACK' if hx == FORBIDDEN else 'NOT-IN-PALETTE'
            violations.append((hx, n, tag))

    total_px = img.size[0] * img.size[1]
    viol_px  = sum(n for _, n, _ in violations)
    pct      = viol_px / total_px * 100

    print(f'\n  ── Color audit: {png_path.name} ──')
    print(f'  unique colors : {len(colors)}')
    print(f'  violations    : {len(violations)}  ({viol_px} px, {pct:.3f}%)')
    if violations:
        for hx, n, tag in sorted(violations, key=lambda x: -x[1])[:20]:
            print(f'    {hx}  {n:6d}px  {tag}')
    else:
        print('  PASS — all pixels on whitelist ✓')

    return {
        'unique': len(colors),
        'viol_count': len(violations),
        'viol_px': viol_px,
        'viol_pct': round(pct, 4),
        'violations': [(hx, n, tag) for hx, n, tag in
                       sorted(violations, key=lambda x: -x[1])[:20]],
    }

# ── S5: composite test ────────────────────────────────────────────────────────

def make_composite(bg_png: Path, label: str, char_x: int, char_y: int,
                   alpha: float, out_path: Path):
    """Paste a simple black-cat silhouette onto background at given position."""
    bg = Image.open(bg_png).convert('RGBA')

    # Build a minimal cat silhouette (60×100px rounded rect = body)
    cat_w, cat_h = 60, 100
    cat = Image.new('RGBA', (cat_w, cat_h), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(cat)
    body_col = tuple(int(pal['character']['kuro_black']['hex'].lstrip('#')[i:i+2], 16)
                     for i in (0, 2, 4))
    # body
    d.ellipse([10, 20, 50, 90], fill=(*body_col, 255))
    # head
    d.ellipse([15, 0, 45, 35], fill=(*body_col, 255))
    # ears
    d.polygon([(15, 10), (5, 0), (22, 5)], fill=(*body_col, 255))
    d.polygon([(45, 10), (55, 0), (38, 5)], fill=(*body_col, 255))
    # cyan eyes
    eye_col = tuple(int(pal['character']['kuro_cyan_eye']['hex'].lstrip('#')[i:i+2], 16)
                    for i in (0, 2, 4))
    d.ellipse([20, 10, 27, 17], fill=(*eye_col, 255))
    d.ellipse([33, 10, 40, 17], fill=(*eye_col, 255))

    # apply alpha (jelly mode)
    if alpha < 1.0:
        r, g, b, a = cat.split()
        a = a.point(lambda p: int(p * alpha))
        cat = Image.merge('RGBA', (r, g, b, a))

    # paste
    px = char_x - cat_w // 2
    py = char_y - cat_h
    bg.paste(cat, (px, py), cat)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out_path)
    print(f'  composite → {out_path.relative_to(ROOT)}  pos=({char_x},{char_y}) α={alpha} [{label}]')

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    print('=== S2+S3: Kitchen West — base background ===')
    base_body = build_kitchen_base()
    svg_path = OUT / 'bg_kitchen_west_base.svg'
    png_path = OUT / 'bg_kitchen_west.png'
    save_svg(svg_path, base_body)
    actual_size = svg_to_png(svg_path, png_path)
    assert actual_size == (W, H), f'Size mismatch: {actual_size} ≠ {W}×{H}'

    print('\n=== S4: Light-form SVGs ===')
    for kf in man['curtain_band_keyframes']:
        t = kf['t']
        p = OUT / f'bg_kitchen_curtain_t{t}.svg'
        make_curtain_band(kf, p)

    for kf in man['light_polygon_keyframes']:
        t = kf['t']
        p = OUT / f'bg_kitchen_light_t{t}.svg'
        make_light_polygon(kf, p)

    print('\n=== S3: Color verification ===')
    audit = verify_colors(png_path)

    print('\n=== S4: Coordinate cross-check ===')
    print('  Manifest vs. drawn — key coordinates:')
    print(f'  fridge_left_x : manifest={man["fridge"]["left_x"]}  drawn={FRG_L}')
    print(f'  window_left_x : manifest={man["window"]["left_x"]}  drawn={WIN_L}')
    print(f'  ground_line_y : manifest={man["ground_line_y"]}  drawn={GND_Y}')
    print(f'  counter_top_y : manifest={man["counter"]["top_y"]}  drawn={CTR_TOP}')
    print(f'  floor_top_y   : manifest={man["counter"]["bottom_y"]}  drawn={FLOOR_TOP}')
    for kf in man['curtain_band_keyframes']:
        if kf['t'] in (124, 170):
            drawn_right = kf['polygon'][2][0]  # third vertex x = right edge at floor
            width       = man['fridge']['left_x'] - drawn_right
            print(f'  curtain t={kf["t"]} right_x={drawn_right}'
                  f'  light_zone={width}px  (manifest={kf["light_zone_width_px"]}px)')

    print('\n=== S5: Composite tests ===')
    tests = [
        ('shadow_area_solid',  200, GND_Y, 1.00, 'black cat in indigo shadow — outline visible?'),
        ('light_zone_jelly',   800, GND_Y, 0.62, 'jelly cat in light zone — background shows through?'),
        ('curtain_band_solid', 500, GND_Y, 1.00, 'solid cat in curtain shadow band'),
        ('fridge_glow_area',   900, GND_Y, 1.00, 'cat near fridge, glow_response area'),
    ]
    for label, cx, cy, alpha, desc in tests:
        out = OUT / 'tests' / f'composite_{label}.png'
        make_composite(png_path, label, cx, cy, alpha, out)
        print(f'    → {desc}')

    print('\n=== TASK 1 delivery summary ===')
    print(f'  bg_kitchen_west.png : {W}×{H}')
    print(f'  color audit         : {audit["viol_count"]} violations '
          f'({audit["viol_pct"]}% of pixels)')
    print(f'  light SVGs          : t=104,124,170,182')
    print(f'  curtain SVGs        : t=104,124,170,182')
    print(f'  composites          : 4 positions')
    if audit['viol_count'] == 0:
        print('\n  ✓  READY — awaiting human PASS')
    else:
        print('\n  ✗  Violations found — check color audit above')


if __name__ == '__main__':
    main()
