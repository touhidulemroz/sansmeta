# SansMeta — Website

Browser version of the cleaning engine, branded **SansMeta** ("Remove Hidden AI Metadata Online for Free"). The FastAPI backend calls the unchanged `app/bridge.py` adapter (same JSON-over-stdio protocol the SwiftUI app uses), which drives the vendored cleaning engine in `upstream/service/scripts/`. Files and pasted text are processed on the machine running the server.

## Layout

- `backend/` — FastAPI app. Routes in `main.py`; subprocess client in `bridge_client.py`; job store in `jobs.py`; batch loops in `pipeline.py`.
- `frontend/` — Vite + React + TypeScript UI, built into `frontend/dist` and served by the backend in production.
- `frontend/public/` — production brand assets (logo mark, favicons, social preview) generated from the approved concept by `../branding/generate_assets.py`.
- `Dockerfile` — multi-stage build producing one deployable service.

## Frontend

React 18 + TypeScript + Vite with plain CSS — no UI framework, no CSS library, no runtime dependencies beyond React. Entry is `src/main.tsx` → `App.tsx`.

### Structure

| File | Role |
| --- | --- |
| `src/App.tsx` | Shell: header (logo, nav, Files/Text segmented control), footer with privacy, source attribution and the retention note |
| `src/components/Landing.tsx` | Always-visible landing: hero + dropzone CTA, formats, how-it-works, scope, terminology, privacy summary, FAQ |
| `src/components/FilesMode.tsx` | State and orchestration: dedupe by `name:size`, inspect/clean jobs, polling, cancel, banners. Renders the workspace below the landing once files are added |
| `src/components/FileDropZone.tsx` | Dropzone: click, drag-over, Space/Enter keyboard activation, busy state |
| `src/components/FileList.tsx`, `FileRow.tsx` | Selected-file list: kind icons, status chips, expandable technical reports, remove/download |
| `src/components/TextMode.tsx` | Text cleaning: original/cleaned panes, live character count, removed/replaced stats, copy and reset |
| `src/components/ProgressBar.tsx`, `ReportView.tsx` | Upload/processing progress; key-value engine reports |
| `src/components/ConsentBanner.tsx` | Analytics consent notice; controls whether the GA script loads |
| `src/components/Icons.tsx` | Inline SVG icon set (no icon dependency) |
| `src/api.ts`, `src/analytics.ts` | API client (contracts above); consent-gated GA4 event helper |
| `src/prerender.tsx` + `prerender.mjs` | Build-time prerender of the landing HTML into `dist/index.html` (see SEO below) |
| `privacy/index.html`, `404.html` | Static public pages built as Vite multi-page entries |

### Design system

All styling lives in `src/styles.css` as CSS custom properties: page/surface/text/accent/border/success/warning/error colors, radii, shadows, spacing scale, and `--page-width: 1120px`. The design is light-first (`color-scheme: light`), warm off-white page with white surfaces, flat indigo primary color (`#4f46e5`), charcoal text (`#191c26`), system font stack, and monospace only for file names and technical values. No gradients, no decorative animation beyond small fades. There is no automatic dark theme.

### Brand assets

Production assets are derived from the approved concept in `web/branding/sansmeta-logo-concept.png` by `web/branding/generate_assets.py` (requires Pillow):

- `public/logo-mark.png` — transparent header mark
- `public/favicon.ico`, `favicon-32.png`, `favicon-192.png`, `icon-512.png` — favicon set
- `public/apple-touch-icon.png` — light brand tile
- `public/og-image.png` — 1200×630 social preview (mark + wordmark + tagline)
- `public/manifest.webmanifest` — web app manifest

A hand-built vector SVG of the mark is still future work; see `web/branding/logo-concept.md`.

### UX rules

- The landing (hero, dropzone, formats, how-it-works, scope, terminology, privacy, FAQ) is always visible in Files mode; the workspace appears directly below it once files are added and scrolls into view.
- Scope messaging is honest and always visible: the tool removes supported C2PA/EXIF/XMP provenance and invisible Unicode marks; it does not remove visible logos, pixel-level SynthID, or guarantee AI-detector outcomes.
- Originals are never modified and cleaned copies are returned separately.

### Accessibility & responsiveness

- Single `h1` per view; segmented control uses `aria-pressed` buttons; dropzone is a keyboard-operable `role="button"`; expandable reports expose `aria-expanded`; FAQ uses native `<details>`; status is never color-only; async feedback uses `aria-live` regions.
- Text contrast meets WCAG AA (≥ 4.5:1); visible focus rings on all interactive elements.
- Layout verified from 320 px to 1900 px with no horizontal overflow; content centers at 1120 px; panes stack below 700 px; touch targets are ≥ 44 px on mobile; `prefers-reduced-motion` disables animations.

## SEO

### Crawlable initial HTML

`npm run build` runs `prerender.mjs`, which renders the React landing (server-side, via `react-dom/server` in Node) into `dist/index.html`. The initial HTML response therefore contains the full landing copy — hero, how-it-works, formats, scope, terminology, privacy summary and FAQ — and the browser hydrates it. All important marketing copy is reachable without JavaScript.

### Canonical URLs, social metadata, sitemap

The backend injects canonical, Open Graph and Twitter tags at request time from the `WEB_PUBLIC_ORIGIN` environment variable (no trailing slash, e.g. `https://your-service.onrender.com`):

- `/` — home (`SansMeta — Remove Hidden AI Metadata Online for Free`)
- `/privacy/` — privacy page (`Privacy — SansMeta`)

When `WEB_PUBLIC_ORIGIN` is unset, absolute SEO tags and `sitemap.xml` are omitted (sitemap returns 404) so previews never advertise an invented domain. `robots.txt` always allows crawling public pages and disallows `/api/`, `/docs` and `/openapi.json`. Job downloads, API responses and file uploads are excluded from indexing and sent with `Cache-Control: no-store` and `X-Robots-Tag: noindex`. Missing pages return a styled 404 with status 404. Structured data (`WebApplication` + `FAQPage`) lives in `index.html`; it contains no reviews, ratings, or unsupported claims.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/inspect` | Multipart (many files + `preserveMetadata`) → per-file findings |
| POST | `/api/clean` | Multipart upload → `{jobId, zipUrl}`; processing runs in the background |
| GET | `/api/jobs/{id}/status` | Poll for per-file results, `done`, `cancelled`, `error` |
| GET | `/api/jobs/{id}/files/{n}` | Download one cleaned copy |
| GET | `/api/jobs/{id}/zip` | Download all cleaned copies as a zip |
| DELETE | `/api/jobs/{id}` | Cancel (stops after the current file); `?purge=true` also deletes files |
| POST | `/api/text` | JSON `{text}` → cleaned text + stats |
| GET | `/api/health` | Liveness check |

Limits: 50 files per batch, 256 MB per file, 8 MB per text paste. Jobs use a 15-minute fallback expiry by default (see `WEB_JOB_TTL_SECONDS`).

## Configuration (env vars)

Copy `web/.env.example` into the environment configuration used by the chosen
host, then adjust only the values needed for that deployment.

| Variable | Default | Meaning |
| --- | --- | --- |
| `WEB_JOBS_DIR` | system temp | Where job workspaces (uploads/exports) live |
| `WEB_JOB_TTL_SECONDS` | `900` | Fallback job expiry in seconds; values are constrained to 1–900 so the privacy fallback never exceeds 15 minutes |
| `WEB_MAX_FILE_BYTES` | `268435456` | Per-file upload cap |
| `WEB_MAX_TEXT_BYTES` | `8388608` | Text paste cap |
| `WEB_API_KEY` | unset | When set, all `/api` routes require `Authorization: Bearer <key>` |
| `WEB_PUBLIC_ORIGIN` | unset | Public origin (no trailing slash) for canonical URLs, social tags and `sitemap.xml` |

## Temporary-file deletion

SansMeta deletes temporary files as soon as it reasonably can, with a short
fallback expiry (default 15 minutes, configurable via `WEB_JOB_TTL_SECONDS`):

- **After a completed individual download** — a Starlette `BackgroundTask` removes
  that exported file only after its response has been fully sent. The remaining
  batch stays available; the job is removed after its last cleaned file is downloaded.
- **After a completed ZIP download** — the `/api/jobs/{id}/zip` handler removes the
  whole job workspace in a Starlette `BackgroundTask`, which runs only after the
  response has been fully sent (files are never removed mid-stream).
- **When you start over or choose "Clear & delete files"** — the workspace issues
  an immediate `DELETE /api/jobs/{id}` purge.
- **When you start a new batch** — the previous job is purged before the new one begins.
- **When you close or hide the page** — the workspace fires a best-effort
  `sendBeacon`/`fetch` keepalive to `POST /api/jobs/{id}/cleanup`.
- **Fallback expiry** — an in-memory sweep removes jobs older than `WEB_JOB_TTL_SECONDS`
  to cover crashes, lost connections, interrupted downloads, or failed beacons.

Deletion is idempotent and never leaks job existence: `DELETE /api/jobs/{id}` and
`POST /api/jobs/{id}/cleanup` always return `200`. Every job also has a separate
256-bit capability token; status, download, cancel, and deletion requests require
both the random job ID and that token, so knowing or changing a job ID is not
enough to access another visitor's workspace. Cleanup requested during processing
or an active response stream is deferred until it is safe. Existing path-validation
(`exports_root in path.parents`) on downloads is preserved.

The frontend fetches the effective retention and limits from the public
`/api/config` endpoint and shows the real fallback period instead of a
hard-coded value.

## Analytics and consent

Google Analytics (GA4) is loaded **only after the visitor accepts** the consent banner; declining loads nothing. The measurement ID lives in `src/analytics.ts` (`GA_MEASUREMENT_ID`).

Tracked events are aggregate only: page views, mode switches, uploads/clean completions (with file counts), downloads (by type), and text cleaning (with character counts). Filenames, file contents, pasted text, and download tokens are never sent. The privacy page (`/privacy/`) documents this behavior.

## Development

```sh
cd web/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install
bash scripts/web-dev.sh      # backend on :8000, vite dev server on :5173
cd web/backend && .venv/bin/pytest tests   # API tests (build the frontend first)
```

## Production

```sh
cd web/frontend && npm run build
cd ../backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

or

```sh
docker build -t sansmeta-web .
docker run -p 8000:8000 sansmeta-web
```

## Host free on Render

The repo-root `render.yaml` Blueprint deploys the Docker service on Render's free plan:

1. Sign up at render.com (GitHub login is easiest).
2. **New + → Blueprint** → connect your GitHub account → select the `watermarks-cleaner-mac` repo.
3. Render reads `render.yaml`, builds the Dockerfile, and deploys. Set `WEB_PUBLIC_ORIGIN` to the service's final URL (e.g. its `.onrender.com` address) to enable canonical URLs, social tags and `sitemap.xml`.

Notes for the free plan:

- The instance sleeps after ~15 min of inactivity; the next visit wakes it (cold start takes about a minute).
- Job links stop working when the instance sleeps or redeploys — jobs are in-memory and files are ephemeral by design.
- Upload cap is lowered to 100 MB (`WEB_MAX_FILE_BYTES`) in the Blueprint to stay within the free plan's RAM.

## Relationship to the Mac app

`app/`, `upstream/`, `tests/`, and `scripts/build.sh` are frozen: the web backend never modifies them, only invokes `app/bridge.py` read-only. Both apps can run side by side; the engine is stateless per invocation and export naming is collision-safe across processes. The Mac app keeps its own name and identity; aligning it with the SansMeta brand is tracked as deferred work in `plan.md`.
