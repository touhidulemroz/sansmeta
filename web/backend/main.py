"""FastAPI backend for the SansMeta website."""
import html as html_lib
import os
import re
import tempfile
import threading
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Body, Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

import bridge_client
import jobs
import pipeline

VERSION = "0.1.0"
MAX_BATCH_FILES = 50
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

store = jobs.JobStore()

PUBLIC_ORIGIN = os.environ.get("WEB_PUBLIC_ORIGIN", "").strip().rstrip("/")

HOME_TITLE = "SansMeta — Remove Hidden AI Metadata Online for Free"
HOME_DESCRIPTION = (
    "Inspect and clean hidden AI metadata, provenance fields, and invisible Unicode "
    "characters from images, documents, audio, video, and text. Free, no account, "
    "originals never modified."
)
PRIVACY_TITLE = "Privacy — SansMeta"
PRIVACY_DESCRIPTION = (
    "How SansMeta handles your files and pasted text: server-side processing, temporary "
    "storage, automatic deletion, download links, limits, and optional analytics."
)


@asynccontextmanager
async def lifespan(_app):
    store.cleanup_expired()
    store.sweep_orphaned()
    yield


app = FastAPI(title="SansMeta Web", version=VERSION, lifespan=lifespan)


class DynamicCORSMiddleware(CORSMiddleware):
    """CORS middleware supporting dynamic origin configuration via WEB_CORS_ORIGINS."""

    def __init__(self, app: ASGIApp, **kwargs):
        super().__init__(
            app,
            allow_origins=(),
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=False,
            expose_headers=["Content-Disposition", "Content-Length"],
            **kwargs,
        )

    def is_allowed_origin(self, origin: str) -> bool:
        raw = os.environ.get("WEB_CORS_ORIGINS", "").strip()
        if not raw or raw == "*":
            return True
        allowed = {o.strip() for o in raw.split(",") if o.strip()}
        return origin in allowed

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        raw = os.environ.get("WEB_CORS_ORIGINS", "").strip()
        if not raw or raw == "*":
            self.allow_all_origins = True
            self.preflight_explicit_allow_origin = False
            self.simple_headers["Access-Control-Allow-Origin"] = "*"
            self.preflight_headers["Access-Control-Allow-Origin"] = "*"
            self.preflight_headers.pop("Vary", None)
        else:
            self.allow_all_origins = False
            self.preflight_explicit_allow_origin = True
            self.simple_headers.pop("Access-Control-Allow-Origin", None)
            self.preflight_headers.pop("Access-Control-Allow-Origin", None)
            self.preflight_headers["Vary"] = "Origin"
        await super().__call__(scope, receive, send)


app.add_middleware(DynamicCORSMiddleware)


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def max_file_bytes():
    return _env_int("WEB_MAX_FILE_BYTES", 256 << 20)


def max_text_bytes():
    return _env_int("WEB_MAX_TEXT_BYTES", 8 * 1024 * 1024)


def require_api_key(request: Request):
    key = os.environ.get("WEB_API_KEY", "").strip()
    if key and request.headers.get("Authorization") != f"Bearer {key}":
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


def _inject_seo(page_html: str, path: str, title: str, description: str) -> str:
    """Inject origin-dependent canonical, Open Graph and Twitter tags.

    When WEB_PUBLIC_ORIGIN is not configured, only the JSON-LD origin
    placeholder is neutralized and no absolute URLs are emitted, which keeps
    previews safe instead of serving an invented domain.
    """
    if PUBLIC_ORIGIN:
        page_html = page_html.replace("__ORIGIN__", PUBLIC_ORIGIN)
    else:
        page_html = page_html.replace("__ORIGIN__/", "/").replace("__ORIGIN__", "")
    if not PUBLIC_ORIGIN:
        return page_html
    image = f"{PUBLIC_ORIGIN}/og-image.png"
    url = f"{PUBLIC_ORIGIN}{path}"
    tags = [
        f'<link rel="canonical" href="{url}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="SansMeta">',
        f'<meta property="og:title" content="{html_lib.escape(title)}">',
        f'<meta property="og:description" content="{html_lib.escape(description)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{image}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{html_lib.escape(title)}">',
        f'<meta name="twitter:description" content="{html_lib.escape(description)}">',
        f'<meta name="twitter:image" content="{image}">',
    ]
    return page_html.replace("</head>", "".join(tags) + "</head>", 1)


def _page(relative: Path, path: str, title: str, description: str, status: int = 200):
    if not relative.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    page_html = relative.read_text(encoding="utf-8").replace(
        "__RETENTION_MINUTES__", str(max(1, round(jobs.job_ttl_seconds() / 60)))
    )
    return HTMLResponse(
        _inject_seo(page_html, path, title, description),
        status_code=status,
    )


@app.middleware("http")
async def privacy_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    elif path in ("/docs", "/redoc", "/openapi.json"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


router = APIRouter(prefix="/api", dependencies=[Depends(require_api_key)])

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._ -]")


def _safe_name(name):
    cleaned = _SAFE_NAME_RE.sub("_", name or "file").strip(" .")
    return cleaned[:120] or "file"


async def _save_upload(upload, directory, index):
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / _safe_name(upload.filename or f"file-{index}")
    limit = max_file_bytes()
    size = 0
    with open(target, "wb") as out:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                out.close()
                target.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"{upload.filename} exceeds the {limit // (1024 * 1024)} MB limit.",
                )
            out.write(chunk)
    return target


async def _save_all(files, base_dir):
    sources = []
    for index, upload in enumerate(files):
        sources.append(await _save_upload(upload, base_dir / str(index), index))
    return sources


def _require_job(job_id, token):
    job = store.get(job_id, token)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return job


@app.get("/api/health")
def health():
    return {"ok": True, "version": VERSION}


@router.post("/inspect")
async def inspect_files(files: list[UploadFile] = File(...), preserveMetadata: bool = Form(True)):
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one file.")
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(status_code=413, detail=f"At most {MAX_BATCH_FILES} files per batch.")
    cancel_event = threading.Event()
    with tempfile.TemporaryDirectory(prefix="sansmeta-web-inspect-") as temp:
        sources = await _save_all(files, Path(temp))
        results, cancelled = await run_in_threadpool(
            pipeline.inspect_batch, sources, cancel_event, bool(preserveMetadata)
        )
    return {"results": results, "cancelled": cancelled}


@router.post("/clean")
async def clean_upload(files: list[UploadFile] = File(...), preserveMetadata: bool = Form(True)):
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one file.")
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(status_code=413, detail=f"At most {MAX_BATCH_FILES} files per batch.")
    job = store.create()
    try:
        sources = await _save_all(files, job.uploads)
    except BaseException:
        store.remove(job.id)
        raise
    job.preserve_metadata = bool(preserveMetadata)
    job.running = True
    threading.Thread(target=_run_clean_job, args=(job, sources), daemon=True).start()
    return {
        "jobId": job.id,
        "jobToken": job.token,
        "statusUrl": f"/api/jobs/{job.id}/status?token={job.token}",
        "zipUrl": f"/api/jobs/{job.id}/zip?token={job.token}",
    }


def _run_clean_job(job, sources):
    try:
        results, cancelled = pipeline.clean_batch(job, sources, job.preserve_metadata)
        job.results = results
        job.cancelled = cancelled
    except Exception as error:
        job.error = str(error)
    finally:
        store.processing_finished(job.id)


@router.get("/jobs/{job_id}/status")
def job_status(job_id: str, token: str = Query("")):
    job = _require_job(job_id, token)
    return {
        "done": not job.running,
        "cancelled": job.cancelled,
        "error": job.error,
        "results": job.results,
        "zipUrl": f"/api/jobs/{job.id}/zip?token={job.token}",
    }


@router.get("/jobs/{job_id}/files/{file_id}")
def download_file(job_id: str, file_id: int, token: str = Query("")):
    job = store.begin_stream(job_id, token)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    entry = next((item for item in job.files if item["index"] == file_id), None)
    if entry is None:
        store.finish_stream(job_id)
        raise HTTPException(status_code=404, detail="No cleaned file for this id.")
    path = Path(entry["export"]).resolve()
    exports_root = job.exports.resolve()
    if not path.is_file() or exports_root not in path.parents:
        store.finish_stream(job_id)
        raise HTTPException(status_code=404, detail="Cleaned file no longer available.")
    cleanup = BackgroundTask(store.finish_stream, job_id, file_id=file_id)
    return FileResponse(path, filename=path.name, background=cleanup)


@router.get("/jobs/{job_id}/zip")
def download_zip(job_id: str, token: str = Query("")):
    job = store.begin_stream(job_id, token)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    exports_root = job.exports.resolve()
    entries = []
    for entry in job.files:
        path = Path(entry["export"]).resolve()
        if path.is_file() and exports_root in path.parents:
            entries.append(path)
    if not entries:
        store.finish_stream(job_id)
        raise HTTPException(status_code=404, detail="No cleaned files to download.")
    handle = tempfile.NamedTemporaryFile(prefix="sansmeta-web-", suffix=".zip", delete=False)
    try:
        with zipfile.ZipFile(handle, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in entries:
                archive.write(path, arcname=path.name)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        store.finish_stream(job_id)
        raise

    temp_path = handle.name

    def cleanup():
        # Runs only after the response has been fully sent to the client, so
        # files are never removed mid-stream. Removing the temporary archive and
        # the whole job workspace completes the "delete after download" flow.
        Path(temp_path).unlink(missing_ok=True)
        store.finish_stream(job_id, delete_job=True)

    return FileResponse(temp_path, filename=f"{job.id}-cleaned.zip", background=BackgroundTask(cleanup))


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, token: str = Query("")):
    """Idempotent purge: cancel processing and delete all temporary files.

    Always returns 200 so callers cannot use the endpoint to probe whether a
    job id is (or was) valid — repeated deletions are safe and reveal nothing
    about another user's jobs.
    """
    deleted = store.request_remove(job_id, token)
    return {"ok": True, "deleted": deleted}


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, token: str = Query("")):
    """Idempotent cancel: stop processing without deleting files yet.

    Temporary files are removed by an explicit purge, by starting a new batch,
    by a completed ZIP download, or by the fallback expiry. Always returns 200
    so job existence is not leaked.
    """
    job = store.get(job_id, token)
    if job is not None:
        job.cancel_event.set()
    return {"ok": True, "deleted": False}


@router.post("/jobs/{job_id}/cleanup")
def cleanup_job(job_id: str, token: str = Query("")):
    """Best-effort purge target for page-close / unload (sendBeacon).

    Idempotent; always returns 200 so job existence is not leaked.
    """
    deleted = store.request_remove(job_id, token)
    return {"ok": True, "deleted": deleted}


@router.post("/text")
async def clean_text(body: dict = Body(...)):
    text = body.get("text", "")
    if len(text.encode("utf-8")) > max_text_bytes():
        raise HTTPException(status_code=413, detail="Paste less than 8 MB of text at a time.")
    return await run_in_threadpool(bridge_client.run, {"action": "text", "text": text})


app.include_router(router)


@app.get("/api/config")
def public_config():
    """Public, non-secret runtime settings for the frontend.

    Exposes the effective retention and upload limits so the UI can show the
    real backend behavior. No secrets (API key, internal paths) are returned.
    """
    return {
        "jobTtlSeconds": jobs.job_ttl_seconds(),
        "maxBatchFiles": MAX_BATCH_FILES,
        "maxFileBytes": max_file_bytes(),
        "maxTextBytes": max_text_bytes(),
    }


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def api_not_found(path: str):
    raise HTTPException(status_code=404, detail="Not found")


@app.get("/", include_in_schema=False)
def home():
    return _page(FRONTEND_DIST / "index.html", "/", HOME_TITLE, HOME_DESCRIPTION)


@app.get("/privacy", include_in_schema=False)
def privacy_redirect():
    return RedirectResponse("/privacy/", status_code=301)


@app.get("/privacy/", include_in_schema=False)
def privacy():
    return _page(FRONTEND_DIST / "privacy" / "index.html", "/privacy/", PRIVACY_TITLE, PRIVACY_DESCRIPTION)


@app.get("/index.html", include_in_schema=False)
def home_redirect():
    return RedirectResponse("/", status_code=301)


@app.get("/privacy.html", include_in_schema=False)
def privacy_html_redirect():
    return RedirectResponse("/privacy/", status_code=301)


@app.get("/privacy/index.html", include_in_schema=False)
def privacy_index_redirect():
    return RedirectResponse("/privacy/", status_code=301)


@app.get("/robots.txt", include_in_schema=False)
def robots():
    lines = [
        "User-agent: *",
        "Disallow: /api/",
        "Disallow: /docs",
        "Disallow: /openapi.json",
    ]
    if PUBLIC_ORIGIN:
        lines.append(f"Sitemap: {PUBLIC_ORIGIN}/sitemap.xml")
    return PlainTextResponse("\n".join(lines) + "\n")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    if not PUBLIC_ORIGIN:
        raise HTTPException(status_code=404, detail="Public origin not configured.")
    urls = [
        ("/", "1.0"),
        ("/privacy/", "0.6"),
    ]
    entries = "".join(
        f"<url><loc>{PUBLIC_ORIGIN}{path}</loc><priority>{priority}</priority></url>"
        for path, priority in urls
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{entries}</urlset>"
    )
    return Response(content=body, media_type="application/xml")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        page = FRONTEND_DIST / "404.html"
        if page.is_file():
            return HTMLResponse(page.read_text(encoding="utf-8"), status_code=404)
    return Response(
        content=f'{{"detail": "{exc.detail or "Not found"}"}}',
        status_code=exc.status_code,
        media_type="application/json",
    )


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
