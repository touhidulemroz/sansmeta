"""Generate production website assets from the approved SansMeta logo concept.

The approved concept is the raster lockup `sansmeta-logo-concept.png`
(icon + wordmark, transparent background). This script crops the approved
artwork into the production files the website uses — it does not redesign
the mark. A hand-built vector SVG of the mark remains future work (see
logo-concept.md).

Requires Pillow: python3 -m venv .venv && .venv/bin/pip install pillow

Usage (from repo root):
    python3 web/branding/generate_assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CONCEPT = ROOT / "web" / "branding" / "sansmeta-logo-concept.png"
PUBLIC = ROOT / "web" / "frontend" / "public"

# Brand colors (from the approved concept spec, logo-concept.md)
INDIGO = "#4f46e5"
CHARCOAL = "#191c26"
TEXT_2 = "#545a6d"
PAGE_BG = "#faf9f7"

TAGLINE = "Remove Hidden AI Metadata Online for Free"

# Bounding boxes measured from the concept PNG (alpha channel).
ICON_BOX = (216, 158, 500, 562)  # mark + detached tab, with ~12 px padding
WORDMARK_BOX = (497, 255, 1962, 495)  # "SansMeta" letters only


def load_mark() -> Image.Image:
    source = Image.open(CONCEPT).convert("RGBA")
    return source.crop(ICON_BOX)


def load_wordmark() -> Image.Image:
    source = Image.open(CONCEPT).convert("RGBA")
    return source.crop(WORDMARK_BOX)


def fit_into(mark: Image.Image, canvas: int, fill: tuple[int, int, int, int]) -> Image.Image:
    canvas_img = Image.new("RGBA", (canvas, canvas), fill)
    scale = canvas / mark.height
    resized = mark.resize(
        (max(1, round(mark.width * scale)), canvas), Image.Resampling.LANCZOS
    )
    x = (canvas - resized.width) // 2
    canvas_img.alpha_composite(resized, (x, 0))
    return canvas_img


def system_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                font = ImageFont.truetype(path, size)
                if bold:
                    font.set_variation_by_axes([0.65])
                return font
            except OSError:
                continue
    return ImageFont.load_default(size)


def generate():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    mark = load_mark()

    # Header logo mark (transparent, tall enough for 2x displays).
    logo_height = 96
    logo = mark.resize(
        (max(1, round(mark.width * logo_height / mark.height)), logo_height),
        Image.Resampling.LANCZOS,
    )
    logo.save(PUBLIC / "logo-mark.png")

    # Favicons and app icons (square canvases).
    TRANSPARENT = (0, 0, 0, 0)
    fit_into(mark, 512, TRANSPARENT).save(PUBLIC / "icon-512.png")
    fit_into(mark, 192, TRANSPARENT).save(PUBLIC / "favicon-192.png")
    icon32 = fit_into(mark, 32, TRANSPARENT)
    icon32.save(PUBLIC / "favicon-32.png")
    icon32.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32)],
    )

    # Apple touch icon: light brand tile so it never renders on black.
    touch = fit_into(mark, 180, (250, 249, 247, 255))
    touch.save(PUBLIC / "apple-touch-icon.png")

    # Open Graph / social preview (1200 x 630).
    og = Image.new("RGB", (1200, 630), PAGE_BG)
    icon_h = 232
    icon = mark.resize(
        (max(1, round(mark.width * icon_h / mark.height)), icon_h),
        Image.Resampling.LANCZOS,
    )
    wordmark_h = 118
    wordmark = load_wordmark().resize(
        (max(1, round(load_wordmark().width * wordmark_h / load_wordmark().height)), wordmark_h),
        Image.Resampling.LANCZOS,
    )
    gap = 52
    row_width = icon.width + gap + wordmark.width
    row_x = (1200 - row_width) // 2
    row_y = 200
    og.paste(icon, (row_x, row_y), icon)
    og.paste(wordmark, (row_x + icon.width + gap, row_y + (icon_h - wordmark_h) // 2), wordmark)
    draw = ImageDraw.Draw(og)
    tagline_font = system_font(44)
    tagline_box = draw.textbbox((0, 0), TAGLINE, font=tagline_font)
    tagline_w = tagline_box[2] - tagline_box[0]
    draw.text(
        ((1200 - tagline_w) // 2, row_y + icon_h + 84),
        TAGLINE,
        fill=TEXT_2,
        font=tagline_font,
    )
    og.save(PUBLIC / "og-image.png")

    print("Generated:")
    for name in [
        "logo-mark.png",
        "icon-512.png",
        "favicon-192.png",
        "favicon-32.png",
        "favicon.ico",
        "apple-touch-icon.png",
        "og-image.png",
    ]:
        print(f"  {PUBLIC / name}")


if __name__ == "__main__":
    generate()
