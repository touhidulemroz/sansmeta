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

## Host on Hugging Face Spaces (free)

The repo-root `Dockerfile` is ready for a free Docker space:

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

Notes for free spaces:

- Spaces sleep after ~48 h of inactivity and wake on the next visit (cold start takes a minute or two).
- Job links stop working when the space sleeps — jobs are in-memory and files are ephemeral by design.
- If large uploads are slow through the HF proxy, lower the cap via a Space env variable, e.g. `WEB_MAX_FILE_BYTES=104857600` (100 MB).

Note: the Docker image includes only the stdlib engine core. Optional external tools (`exiftool`, `c2patool`, `qpdf`, `ghostscript`, `ffmpeg`) are not installed, so some metadata probes and PDF deep-cleaning degrade gracefully — the same behavior the Mac app has when those tools are absent.

## Relationship to the Mac app

`app/`, `upstream/`, `tests/`, and `scripts/build.sh` are frozen: the web backend never modifies them, only invokes `app/bridge.py` read-only. Both apps can run side by side; the engine is stateless per invocation and export naming is collision-safe across processes.
