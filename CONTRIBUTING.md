# Contributing to SansMeta

Thank you for your interest in contributing to SansMeta! We welcome bug fixes, documentation improvements, new format cleaners, and feature suggestions that align with our privacy-first principles.

---

## Architecture Overview

- **`web/frontend/`** — React 18 + TypeScript + Vite 5 frontend with static prerendering.
- **`web/backend/`** — FastAPI service (Python 3.11+) handling file uploads, temporary sandbox execution, metadata inspection, and auto-purge.
- **`app/`** — Native macOS standalone SwiftUI application for local file cleaning on Apple Silicon.
- **`upstream/`** — Vendored snapshot of the core metadata cleaning and inspection engine.
- **`tests/`** — End-to-end integration tests verifying cross-platform cleaning operations.

---

## Core Privacy Principles

All contributions must strictly respect SansMeta's privacy architecture:
1. **Zero permanent storage:** User files must live strictly in ephemeral job directories and be purged automatically upon download or expiration.
2. **Originals are preserved:** Processing must always produce a separate clean copy without altering original files in place.
3. **No tracking or accounts:** Do not introduce telemetry, cookies, or user tracking into the core experience.
4. **Honest capabilities:** SansMeta strips metadata (C2PA manifests, EXIF/XMP, AI tool tags, invisible Unicode marks). It does not alter image pixels, remove visual logos, or guarantee bypass of AI detectors.

---

## Local Development Setup

### 1. Web Backend (FastAPI)

Requirements: Python 3.11+

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run backend development server
uvicorn app.main:app --reload --port 8000
```

Run backend tests:
```bash
pytest tests -v
```

### 2. Web Frontend (React + Vite)

Requirements: Node.js 18+ or 20+

```bash
cd web/frontend
npm install

# Start Vite development server
npm run dev

# Typecheck and build production assets (with static prerendering)
npm run build
```

### 3. Integration Tests

Run the engine integration test suite from the repository root:

```bash
python3 -m unittest discover -s tests -v
```

### 4. macOS Native App (Optional)

Requirements:
- Apple Silicon Mac
- Xcode Command Line Tools (`xcode-select --install`)
- Python 3.10+

Build the native macOS app:
```bash
bash scripts/build.sh
```
The output bundle will be located at `dist/Watermarks Cleaner.app`.

---

## Pull Request Guidelines

1. Fork the repository and create a descriptive branch:
   ```bash
   git checkout -b fix/issue-description
   # or
   git checkout -b feat/new-capability
   ```
2. Ensure all tests pass before submitting:
   - Backend: `pytest web/backend/tests`
   - Frontend: `npm run build` in `web/frontend`
   - Integration: `python3 -m unittest discover -s tests`
3. Verify that no private keys, API secrets, or extraneous test files are committed.
4. Submit your pull request with the provided PR template.
