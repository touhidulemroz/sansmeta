"""FastAPI backend for the web version of Watermarks Cleaner."""
import os
import re
import tempfile
import threading
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Body, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

import bridge_client
import jobs
import pipeline

VERSION = "0.1.0"
MAX_BATCH_FILES = 50
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

store = jobs.JobStore()


@asynccontextmanager
async def lifespan(_app):
    store.cleanup_expired()
    store.sweep_orphaned()
    yield


app = FastAPI(title="Watermarks Cleaner Web", version=VERSION, lifespan=lifespan)


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


def _require_job(job_id):
    job = store.get(job_id)
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
    with tempfile.TemporaryDirectory(prefix="watermarks-web-inspect-") as temp:
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
    threading.Thread(target=_run_clean_job, args=(job, sources), daemon=True).start()
    return {
        "jobId": job.id,
        "statusUrl": f"/api/jobs/{job.id}/status",
        "zipUrl": f"/api/jobs/{job.id}/zip",
    }


def _run_clean_job(job, sources):
    job.running = True
    try:
        results, cancelled = pipeline.clean_batch(job, sources, job.preserve_metadata)
        job.results = results
        job.cancelled = cancelled
    except Exception as error:
        job.error = str(error)
    finally:
        job.running = False


@router.get("/jobs/{job_id}/status")
def job_status(job_id: str):
    job = _require_job(job_id)
    return {
        "done": not job.running,
        "cancelled": job.cancelled,
        "error": job.error,
        "results": job.results,
        "zipUrl": f"/api/jobs/{job.id}/zip",
    }


@router.get("/jobs/{job_id}/files/{file_id}")
def download_file(job_id: str, file_id: int):
    job = _require_job(job_id)
    entry = next((item for item in job.files if item["index"] == file_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="No cleaned file for this id.")
    path = Path(entry["export"]).resolve()
    exports_root = job.exports.resolve()
    if not path.is_file() or exports_root not in path.parents:
        raise HTTPException(status_code=404, detail="Cleaned file no longer available.")
    return FileResponse(path, filename=path.name)


@router.get("/jobs/{job_id}/zip")
def download_zip(job_id: str):
    job = _require_job(job_id)
    exports_root = job.exports.resolve()
    entries = []
    for entry in job.files:
        path = Path(entry["export"]).resolve()
        if path.is_file() and exports_root in path.parents:
            entries.append(path)
    if not entries:
        raise HTTPException(status_code=404, detail="No cleaned files to download.")
    handle = tempfile.NamedTemporaryFile(prefix="watermarks-web-", suffix=".zip", delete=False)
    try:
        with zipfile.ZipFile(handle, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in entries:
                archive.write(path, arcname=path.name)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise
    cleanup = BackgroundTask(Path(handle.name).unlink, missing_ok=True)
    return FileResponse(handle.name, filename=f"{job.id}-cleaned.zip", background=cleanup)


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, purge: bool = False):
    job = _require_job(job_id)
    if purge:
        store.remove(job_id)
        return {"ok": True, "cancelled": True, "purged": True}
    job.cancel_event.set()
    return {"ok": True, "cancelled": True, "purged": False}


@router.post("/text")
async def clean_text(body: dict = Body(...)):
    text = body.get("text", "")
    if len(text.encode("utf-8")) > max_text_bytes():
        raise HTTPException(status_code=413, detail="Paste less than 8 MB of text at a time.")
    return await run_in_threadpool(bridge_client.run, {"action": "text", "text": text})


app.include_router(router)

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
