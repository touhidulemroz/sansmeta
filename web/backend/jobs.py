"""In-memory job store with workspace directories and TTL cleanup."""
import os
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path


def jobs_base_dir():
    return Path(os.environ.get("WEB_JOBS_DIR") or tempfile.gettempdir()) / "watermarks-web-jobs"


def job_ttl_seconds():
    try:
        return float(os.environ.get("WEB_JOB_TTL_SECONDS", "3600"))
    except ValueError:
        return 3600.0


@dataclass
class Job:
    id: str
    workspace: Path
    uploads: Path
    exports: Path
    files: list = field(default_factory=list)
    preserve_metadata: bool = True
    running: bool = False
    results: list = field(default_factory=list)
    cancelled: bool = False
    error: str = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    created_at: float = field(default_factory=time.time)


class JobStore:
    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()
        self._cleanup_thread = None

    def create(self):
        job_id = uuid.uuid4().hex[:16]
        workspace = jobs_base_dir() / job_id
        job = Job(
            id=job_id,
            workspace=workspace,
            uploads=workspace / "uploads",
            exports=workspace / "exports",
        )
        job.uploads.mkdir(parents=True, exist_ok=True)
        job.exports.mkdir(parents=True, exist_ok=True)
        with self._lock:
            self._jobs[job_id] = job
            self._ensure_cleanup_thread()
        return job

    def get(self, job_id):
        with self._lock:
            return self._jobs.get(job_id)

    def remove(self, job_id):
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is not None:
            job.cancel_event.set()
            shutil.rmtree(job.workspace, ignore_errors=True)

    def cleanup_expired(self):
        ttl = job_ttl_seconds()
        if ttl <= 0:
            return 0
        deadline = time.time() - ttl
        with self._lock:
            expired = [job_id for job_id, job in self._jobs.items() if job.created_at < deadline]
        for job_id in expired:
            self.remove(job_id)
        return len(expired)

    def sweep_orphaned(self):
        base = jobs_base_dir()
        if not base.is_dir():
            return 0
        with self._lock:
            known = set(self._jobs)
        removed = 0
        for child in base.iterdir():
            if child.is_dir() and child.name not in known:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        return removed

    def _ensure_cleanup_thread(self):
        if job_ttl_seconds() <= 0 or self._cleanup_thread is not None:
            return
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def _cleanup_loop(self):
        while True:
            time.sleep(300)
            self.cleanup_expired()
