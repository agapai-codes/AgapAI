#!/usr/bin/env python3
"""Generate PWA icon set for AgapAI using the official brand logo emblem.

Design:
  Crop the hands circle emblem + three stars from public/logo.jpg,
  excluding the "AgapAI" wordmark and baybayin script.
  Pad onto a native white tile.

Variants:
  * "any"        -- rounded corners (rad 0.18), artwork scaled to 0.88 safe zone
  * "maskable"   -- full-bleed square, artwork inside 0.62 safe zone
  * apple touch  -- 180px, slight corner rounding (rad 0.10), 0.78 safe zone
  * favicon      -- multi-frame ICO (16, 32, 48) + 64px PNG

Usage: python3 scripts/generate-icons.py
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
LOGO_PATH = ROOT / "public" / "logo.jpg"

BG = (255, 255, 255, 255)  # Native logo white background


def extract_emblem(logo_path: Path) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Programmatically detect and crop the emblem from logo.jpg, padded to square."""
    img = Image.open(logo_path).convert("RGB")
    arr = np.array(img, dtype=np.int16)
    diff = 255 - np.min(arr, axis=2)

    # Scan for separator row between emblem and wordmark (~y=250..255)
    sep_y = 251
    for y in range(230, 270):
        if np.sum(diff[y] > 20) == 0:
            sep_y = y
            break

    # Find bounding box of emblem above the separator row
    # Threshold 20 ignores JPEG compression noise
    emblem_mask = diff[:sep_y] > 20
    ys, xs = np.where(emblem_mask)

    min_x = max(0, int(xs.min()) - 1)
    max_x = min(img.width, int(xs.max()) + 2)
    min_y = max(0, int(ys.min()) - 1)
    max_y = min(sep_y, int(ys.max()) + 2)

    crop_box = (min_x, min_y, max_x, max_y)
    crop = img.crop(crop_box)

    # Clean any residual JPEG artifacts outside the swoosh at the bottom edge (y >= 244)
    crop_arr = np.array(crop)
    for y in range(len(crop_arr)):
        orig_y = y + min_y
        if orig_y >= 244:
            for x in range(len(crop_arr[y])):
                orig_x = x + min_x
                if orig_x > 215 or orig_x < 130:
                    crop_arr[y, x] = [255, 255, 255]

    cleaned_crop = Image.fromarray(crop_arr)

    # Pad crop to a square on a white tile
    w, h = cleaned_crop.size
    dim = max(w, h)
    sq = Image.new("RGBA", (dim, dim), BG)
    pad_x = (dim - w) // 2
    pad_y = (dim - h) // 2
    sq.paste(cleaned_crop, (pad_x, pad_y))

    return sq, crop_box


def draw_mark(base_emblem: Image.Image, size: int, safe: float) -> Image.Image:
    """Render the emblem at `size`, with artwork scaled by `safe` (0..1) on a white tile."""
    art_size = int(round(size * safe))
    art = base_emblem.resize((art_size, art_size), Image.LANCZOS)

    # Crisp sharpening on tiny favicon scales so details pop
    if size <= 32:
        art = art.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=2))

    tile = Image.new("RGBA", (size, size), BG)
    offset = (size - art_size) // 2
    tile.paste(art, (offset, offset))
    return tile


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

    base_emblem, crop_box = extract_emblem(LOGO_PATH)
    print(f"Extracted emblem with crop box: {crop_box} -> square base {base_emblem.size}")

    specs = [
        # name, size, safe-zone fraction, rounded corner fraction (0 = full bleed)
        ("icon-192.png", 192, 0.88, 0.18),
        ("icon-512.png", 512, 0.88, 0.18),
        ("icon-192-maskable.png", 192, 0.62, 0.0),
        ("icon-512-maskable.png", 512, 0.62, 0.0),
        ("apple-touch-icon.png", 180, 0.78, 0.10),
    ]

    for name, size, safe, rad in specs:
        img = draw_mark(base_emblem, size, safe)
        if rad:
            img = rounded(img, rad)
        img.save(OUT / name, "PNG", optimize=True)
        print(f"wrote {OUT / name}")

    # Favicon: multi-frame ICO (16, 32, 48) built from >=48px base so PIL retains all frames
    ico_imgs = {s: draw_mark(base_emblem, s, 0.90) for s in (16, 32, 48)}
    ico_path = ROOT / "src" / "app" / "favicon.ico"
    ico_imgs[48].save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_imgs[16], ico_imgs[32]],
    )
    print(f"wrote {ico_path}")

    # Also mirror a favicon into /public for SW precache consistency
    draw_mark(base_emblem, 64, 0.90).save(OUT / "favicon-64.png", "PNG", optimize=True)
    print(f"wrote {OUT / 'favicon-64.png'}")

    # Quick sanity: verify no fully-transparent output
    for name, *_ in specs:
        im = Image.open(OUT / name).convert("RGBA")
        alpha = im.getchannel("A")
        assert alpha.getextrema() == (0, 255) or alpha.getextrema()[0] > 0, name
    print("icon set OK")


if __name__ == "__main__":
    main()
