# SansMeta logo concept

Created using the built-in image generation tool. Raster concept asset: `sansmeta-logo-concept.png`.

## Generation prompt

Use case: logo-brand. Create a polished final logo for SansMeta, a modern website for cleaning hidden AI metadata from files. A single horizontal brand lockup, icon left and exact wordmark 'SansMeta' right. Design concept: a strong distinctive geometric abstract S built from two clean interlocking file-layer shapes separated by deliberate negative space, with a small detached rectangular data tab suggesting removal of hidden metadata while preserving the main content. Keep exceptionally simple and optically balanced; recognizable at favicon size. Flat vector-like graphic, crisp precise edges, professional Swiss-inspired typography, medium-bold contemporary sans-serif wordmark with tasteful tight kerning. Icon solid indigo #4f46e5, wordmark very dark charcoal #191c26. Genuine transparent background. Generous clear space. No water drop, no sparkle, no stars, no wand, no robot, no shield, no locks, no gradient, no shadows, no 3D, no mockup, no decorative pattern, no extra text, no tagline. Output a clean high-resolution horizontal logo asset, not a presentation board.

## Production assets (implemented)

The website uses production assets derived directly from the approved concept PNG by
`generate_assets.py` (Pillow; `python3 web/branding/generate_assets.py`). The script
crops the approved artwork — it does not redesign it:

- `../frontend/public/logo-mark.png` — transparent header mark (icon only)
- `../frontend/public/favicon.ico`, `favicon-32.png`, `favicon-192.png`, `icon-512.png` — favicon set
- `../frontend/public/apple-touch-icon.png` — 180 px light brand tile
- `../frontend/public/og-image.png` — 1200×630 social preview: mark + wordmark crop + tagline on the page background
- `../frontend/public/manifest.webmanifest` — web app manifest

The wordmark in the site header and pages is set as text ("SansMeta") in the brand font
stack rather than as a raster lockup, so it stays crisp and accessible at every size.

## Remaining asset gaps

- **Vector SVG of the mark.** Only the raster concept exists; the production set above is
  raster-derived. A hand-built editable SVG (mark and lockup) that reproduces the approved
  geometry is still future work. Do not substitute a redesigned mark.
- **Small-size favicon validation.** The favicon set is derived from the concept at
  16/32 px and was sanity-checked visually, but a dedicated optical review at favicon
  sizes by the brand owner is still recommended.
