# Watermarks Cleaner — Web Version

Browser version of the Mac app. The FastAPI backend calls the unchanged `app/bridge.py` adapter (same JSON-over-stdio protocol the SwiftUI app uses), which drives the vendored cleaning engine in `upstream/service/scripts/`. Files stay on the machine running the server.

## Layout

- `backend/` — FastAPI app. Routes in `main.py`; subprocess client in `bridge_client.py`; job store in `jobs.py`; batch loops in `pipeline.py`.
- `frontend/` — Vite + React + TypeScript UI, built into `frontend/dist` and served by the backend in production.
- `Dockerfile` — multi-stage build producing one deployable service.

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

Limits: 50 files per batch, 256 MB per file, 8 MB per text paste. Jobs expire after 1 hour.

## Configuration (env vars)

| Variable | Default | Meaning |
| --- | --- | --- |
| `WEB_JOBS_DIR` | system temp | Where job workspaces (uploads/exports) live |
| `WEB_JOB_TTL_SECONDS` | `3600` | Job expiry; `0` disables cleanup |
| `WEB_MAX_FILE_BYTES` | `268435456` | Per-file upload cap |
| `WEB_MAX_TEXT_BYTES` | `8388608` | Text paste cap |
| `WEB_API_KEY` | unset | When set, all `/api` routes require `Authorization: Bearer <key>` |

## Development

```sh
cd web/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install
bash scripts/web-dev.sh      # backend on :8000, vite dev server on :5173
cd web/backend && .venv/bin/pytest tests   # API tests
```

## Production

```sh
cd web/frontend && npm run build
cd ../backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

or

```sh
docker build -t watermarks-cleaner-web .
docker run -p 8000:8000 watermarks-cleaner-web
```

## Host free on Render

The repo-root `render.yaml` Blueprint deploys the Docker service on Render's free plan:

1. Sign up at render.com (GitHub login is easiest).
2. **New + → Blueprint** → connect your GitHub account → select the `watermarks-cleaner-mac` repo.
3. Render reads `render.yaml`, builds the Dockerfile, and deploys — your app is then live at `https://watermarks-cleaner.onrender.com`.

Notes for the free plan:

- The instance sleeps after ~15 min of inactivity; the next visit wakes it (cold start takes about a minute).
- Job links stop working when the instance sleeps or redeploys — jobs are in-memory and files are ephemeral by design.
- Upload cap is lowered to 100 MB (`WEB_MAX_FILE_BYTES`) in the Blueprint to stay within the free plan's RAM.

## Host on Hugging Face Spaces

Docker spaces now require a paid HF PRO subscription, so Render is the recommended free host. If you have PRO, the repo-root `Dockerfile` works there too:

1. On huggingface.co, create a new Space and choose the **Docker** SDK (public or private).
2. Push this repository to the Space's git remote:

   ```sh
   git remote add space https://huggingface.co/spaces/<your-name>/<space-name>
   git push space main:main
   ```

3. Edit the Space's README on HF and set this frontmatter so the proxy routes to the right port:

   ```yaml
   ---
   title: Watermarks Cleaner
   emoji: 💧
   colorFrom: indigo
   colorTo: cyan
   sdk: docker
   app_port: 7860
   pinned: false
   ---
   ```

Note: the Docker image includes only the stdlib engine core. Optional external tools (`exiftool`, `c2patool`, `qpdf`, `ghostscript`, `ffmpeg`) are not installed, so some metadata probes and PDF deep-cleaning degrade gracefully — the same behavior the Mac app has when those tools are absent.

## Analytics

The web frontend includes Google Analytics (GA4) for usage tracking.

### What's tracked

- **Page views** — fired on mode switches (since the app is an SPA without routing)
- **Mode switches** — when users switch between Files and Text modes
- **Uploads** — when users start inspecting or cleaning (with file count)
- **Clean completions** — when a batch finishes (with file count)
- **Downloads** — individual files and zip downloads
- **Text cleaning** — when text mode is used (with character count)

### Configuration

The GA4 Measurement ID is set in `frontend/index.html`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_ID"></script>
```

Replace `G-YOUR_ID` with your GA4 Measurement ID to track a different property.

### Disabling analytics

To remove analytics entirely, delete the `<script>` tags from `frontend/index.html` and the `trackEvent` calls in the React components.

## Relationship to the Mac app

`app/`, `upstream/`, `tests/`, and `scripts/build.sh` are frozen: the web backend never modifies them, only invokes `app/bridge.py` read-only. Both apps can run side by side; the engine is stateless per invocation and export naming is collision-safe across processes.
