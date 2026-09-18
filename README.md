# SansMeta

**Strip AI provenance metadata and invisible watermarks — without ever storing your files.**

SansMeta is an open-source, privacy-first tool that inspects and removes hidden AI markers — C2PA manifests, AI-specific EXIF/XMP tags, and invisible Unicode watermarks — from images, documents, audio/video, and pasted text. No accounts. No tracking. No permanent storage. Your originals are never touched.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why SansMeta

Every major AI image and text generator now embeds invisible signals in its output — C2PA content-credential manifests, tool-signature EXIF/XMP fields, or zero-width Unicode characters slipped into text. These markers travel silently with your files long after you've stopped thinking about them, and most "metadata cleaner" tools either want your email address, hold your files on a server indefinitely, or only handle one file type at a time.

SansMeta does one thing and does it transparently: it shows you exactly what's embedded, strips it, and deletes everything — including your uploaded copy — within minutes. The code is MIT-licensed and readable end to end, so "trust us" is never the only option.

## What it cleans

| Category | Formats | Removes |
|---|---|---|
| **Images** | PNG, JPEG, WebP, AVIF, HEIC/HEIF, SVG | C2PA manifests, AI tool signatures (Midjourney, DALL·E, Stable Diffusion, Firefly), EXIF/IPTC/XMP — pixels untouched |
| **Documents** | PDF, DOCX, XLSX, PPTX, EPUB, HTML, Markdown | Author traces, AI-generation comments, revision history, metadata streams |
| **Audio/Video** | MP3, WAV, M4A, FLAC, OGG, AAC, AIFF, MP4, MOV, MKV, WEBM, AVI | Metadata headers, tool tags, non-media metadata tracks |
| **Text** | Pasted text | Zero-width characters, BiDi/Trojan Source overrides, soft hyphens, Unicode tags, variation selectors — with a live removed-character counter |

**Out of scope, on purpose:** SansMeta does not remove visible watermarks, logos, or pixel-frequency marks like Google SynthID, and it never rewrites or rephrases your text. It cleans metadata, not content.

## How it works

1. **Upload** up to 50 files (256 MB each) via drag-and-drop, or paste text.
2. **Inspect** — see exactly what hidden markers were found, before anything is changed.
3. **Clean** — SansMeta produces a separate sanitized copy; your original is never modified.
4. **Download** — get your file back instantly. It's deleted from the server the moment you download it, or automatically after 15 minutes of inactivity.

## Architecture

- **Frontend** — React 18 + TypeScript + Vite 5, with a static-prerendered build for zero cold-start page loads and full SEO metadata.
- **Backend** — FastAPI (Python 3.11+) on Uvicorn, deployable to Cloud Run, Railway, Render, or your own VPS.
- **Engine** — Deterministic offline metadata and watermark cleaner driving image, document, audio/video, and text cleaning via `engine/bridge.py`.

## Privacy architecture

- **No accounts, no cookies** — sessions are scoped to random, temporary job IDs.
- **Zero permanent retention** — processed files live only in ephemeral sandbox storage for the duration of the session.
- **Hard auto-purge** — every job is deleted within 15 minutes of inactivity, or immediately on download.
- **Fully open source** — MIT licensed and verifiable, not "trust us."

## Getting started

```bash
git clone https://github.com/touhidulemroz/sansmeta.git
cd sansmeta
```

**Backend (FastAPI)**

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend (Vite + React)**

```bash
cd web/frontend
npm install
npm run dev
# runs at http://localhost:5173
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /health`, `GET /api/config` | Service health and runtime config |
| `POST /api/upload` | Batch upload, returns tokenized file entries |
| `POST /api/inspect` | Pre-clean metadata inspection report |
| `POST /api/clean` | Runs the sanitization pass |
| `POST /api/text` | Real-time invisible-Unicode cleaner |
| `GET /api/download/{token}` | Download one cleaned file |
| `GET /api/download-all/{jobId}` | Download the whole job as a zip |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, testing instructions, and pull request guidelines.

## Security

Please see [SECURITY.md](SECURITY.md) for vulnerability disclosure guidelines.

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by [Touhidul Islam Emroz](https://github.com/touhidulemroz).
