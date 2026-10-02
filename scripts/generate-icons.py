#!/usr/bin/env python3
"""Generate PWA icon set for AgapAI.

Design: emergency beacon pin (map pin + pulse rings) on a dark tile.
Deliberately NOT a red cross -- the Red Cross emblem is protected.

Variants:
  * "any"       -- rounded corners, artwork occupies most of the tile
  * "maskable"  -- full-bleed square, artwork inside the 80% safe zone
  * apple touch  -- 180px, no transparency, slight corner rounding

Usage: python3 scripts/generate-icons.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"

BG = (10, 10, 13, 255)  # #0A0A0D
PIN = (239, 68, 68, 255)  # red-500
PIN_EDGE = (254, 202, 202, 255)  # red-200
HOLE = (10, 10, 13, 255)
RING = (239, 68, 68)


def _lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def draw_mark(size: int, safe: float, ss: int = 4) -> Image.Image:
    """Render the beacon mark at `size`, with artwork scaled by `safe` (0..1)."""
    S = size * ss
    img = Image.new("RGBA", (S, S), BG)
    d = ImageDraw.Draw(img, "RGBA")

    cx, cy = S / 2, S * 0.47
    unit = S * safe

    # Pulse rings (faint, expanding outward)
    for i, (rad, alpha) in enumerate(((0.34, 46), (0.44, 26))):
        r = rad * unit
        w = max(2, int(0.022 * unit))
        d.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(RING[0], RING[1], RING[2], alpha),
            width=w,
        )

    # Pin head
    head_r = 0.215 * unit
    d.ellipse(
        [cx - head_r, cy - head_r, cx + head_r, cy + head_r],
        fill=PIN,
        outline=PIN_EDGE,
        width=max(1, int(0.012 * unit)),
    )

    # Pin tail (triangle from head sides down to the point)
    tip_y = cy + 0.46 * unit
    half = head_r * 0.86
    d.polygon(
        [(cx - half, cy + head_r * 0.15), (cx + half, cy + head_r * 0.15), (cx, tip_y)],
        fill=PIN,
    )

    # Re-draw head over the tail seam, then punch the hole
    d.ellipse([cx - head_r, cy - head_r, cx + head_r, cy + head_r], fill=PIN)
    hole_r = 0.082 * unit
    d.ellipse(
        [cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r],
        fill=HOLE,
    )
    # Inner glint so the hole reads as a lens on very small sizes
    glint_r = hole_r * 0.42
    d.ellipse(
        [cx - glint_r - hole_r * 0.1, cy - glint_r - hole_r * 0.1,
         cx - hole_r * 0.1 + glint_r * 0.1, cy - hole_r * 0.1 + glint_r * 0.1],
        fill=(255, 255, 255, 235),
    )

    return img.resize((size, size), Image.LANCZOS)


def rounded(img: Image.Image, radius_frac: float) -> Image.Image:
    """Composite onto a transparent canvas with rounded corners."""
    ss = 4
    S = img.size[0]
    mask = Image.new("L", (S * ss, S * ss), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, S * ss - 1, S * ss - 1], radius=int(radius_frac * S * ss), fill=255
    )
    mask = mask.resize((S, S), Image.LANCZOS)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    specs = [
        # name, size, safe-zone fraction, rounded corner fraction (0 = full bleed)
        ("icon-192.png", 192, 0.88, 0.18),
        ("icon-512.png", 512, 0.88, 0.18),
        ("icon-192-maskable.png", 192, 0.62, 0.0),
        ("icon-512-maskable.png", 512, 0.62, 0.0),
        ("apple-touch-icon.png", 180, 0.78, 0.10),
    ]

    for name, size, safe, rad in specs:
        img = draw_mark(size, safe)
        if rad:
            img = rounded(img, rad)
        img.save(OUT / name, "PNG", optimize=True)
        print(f"wrote {OUT / name}")

    # Favicon: transparent-friendly square, keep it un-rounded at 32/48
    ico_imgs = [draw_mark(s, 0.9, ss=4) for s in (16, 32, 48)]
    ico_imgs[0].save(ROOT / "src" / "app" / "favicon.ico",
                     sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ROOT / 'src' / 'app' / 'favicon.ico'}")

    # Also mirror a favicon into /public for SW precache consistency
    draw_mark(64, 0.9).save(OUT / "favicon-64.png", "PNG", optimize=True)
    print(f"wrote {OUT / 'favicon-64.png'}")

    # Quick sanity: verify no fully-transparent output
    for name, *_ in specs:
        im = Image.open(OUT / name).convert("RGBA")
        alpha = im.getchannel("A")
        assert alpha.getextrema() == (0, 255) or alpha.getextrema()[0] > 0, name
    print("icon set OK")


if __name__ == "__main__":
    main()
