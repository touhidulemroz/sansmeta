# Watermarks Cleaner for Mac

A native SwiftUI Mac app that removes AI provenance metadata and hidden watermark characters from your files — completely offline, on your own Mac.

Built on the deterministic cleaning engine of [guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover) (MIT).

## Features

- **Inspect before you clean** — see hidden metadata and text marks the engine finds, per file.
- **Batch cleaning** — drop or add many files; originals are always preserved.
- **Safe exports** — every clean writes a new `name.cleaned.ext` copy into a folder you choose; existing exports are never overwritten, even across concurrent app runs.
- **Text mode** — paste text, remove invisible Unicode marks, copy the result.
- **Metadata control** — keep ordinary photo/media metadata (default), or request broader removal.
- **Local only** — no account, API key, server, or internet connection. Files never leave your Mac.

## Usage

1. Add or drop files into the window (images, documents, audio, video, or text).
2. **Inspect all** to review hidden metadata and text marks.
3. **Clean & save copies…** and choose an output folder.
4. Select a file to read its technical report or reveal the saved copy in Finder.

**Stop** ends a batch after the current file finishes. Each operation has a three-minute timeout; the engine's input limit is 256 MB per file.

## Install

Open **dist/Watermarks Cleaner.app** in Finder and move it to Applications if you like. The cleaning engine is bundled inside the app; it uses this Mac's Python 3.10+ installation.

## Scope & limitations

Removes supported AI provenance metadata — C2PA/EXIF/XMP fields — and hidden Unicode characters. It does **not** erase visible logos, remove pixel-level SynthID, rewrite text, or guarantee AI detectors judge content human-written. Upstream's optional model/research backends are not configured in this app.

PDF processing is best-effort without optional tools (qpdf, exiftool, Ghostscript). Files with incomplete cleaning or residual marks are labeled for review — always check the result when document appearance or metadata preservation matters.

## Repository layout

```
app/                    SwiftUI interface + local adapter
  WatermarksApp.swift     UI, batch orchestration, reports
  bridge.py               JSON-over-stdio adapter to the engine
  Assets/, Info.plist     Icon and bundle metadata
scripts/build.sh        Builds dist/Watermarks Cleaner.app (ad-hoc signed)
tests/test_app.py       Integration tests (stdlib unittest)
upstream/               Pinned, unmodified cleaning engine (vendored)
  service/scripts/        The upstream cleaners
  tests/fixtures/         Samples used by the integration tests
  LICENSE                 Upstream MIT license
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design, and [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and the upstream-update procedure.

## Build and verify

Requirements: Apple Silicon Mac, Xcode Command Line Tools, Python 3.10+. This build is locally ad-hoc signed, not notarized for public distribution. It uses Python from `/opt/homebrew/bin`, `/usr/local/bin`, or `/usr/bin`.

```sh
bash scripts/build.sh
python3 -m unittest discover -s tests -v
```

## License

The cleaning engine is [guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover) (MIT), pinned at revision `e4d2bd49c4cb84c5fddb50f5361618cfb3b75def`; its license is retained in `upstream/LICENSE` and inside the app bundle. No upstream hooks, agent skills, network service, or optional model backends are installed or launched.
