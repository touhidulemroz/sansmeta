"""In-memory job store with workspace directories and TTL cleanup."""
import os
import secrets
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path


def jobs_base_dir():
    return Path(os.environ.get("WEB_JOBS_DIR") or tempfile.gettempdir()) / "sansmeta-web-jobs"


def job_ttl_seconds():
    try:
        configured = float(os.environ.get("WEB_JOB_TTL_SECONDS", "900"))
    except ValueError:
        return 900.0
    # The privacy contract promises a fallback no longer than 15 minutes.
    return min(900.0, max(1.0, configured))


@dataclass
class Job:
    id: str
    token: str
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
    delete_requested: bool = False
    active_streams: int = 0
    expiry_timer: threading.Timer = None


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
            token=secrets.token_urlsafe(32),
            workspace=workspace,
            uploads=workspace / "uploads",
            exports=workspace / "exports",
        )
        job.uploads.mkdir(parents=True, exist_ok=True)
        job.exports.mkdir(parents=True, exist_ok=True)
        with self._lock:
            self._jobs[job_id] = job
            self._ensure_cleanup_thread()
        job.expiry_timer = threading.Timer(job_ttl_seconds(), self.request_remove, args=(job_id,))
        job.expiry_timer.daemon = True
        job.expiry_timer.start()
        return job

    @staticmethod
    def _authorized(job, token):
        return bool(job and token and secrets.compare_digest(job.token, token))

    def get(self, job_id, token=None):
        with self._lock:
            job = self._jobs.get(job_id)
            return job if token is None or self._authorized(job, token) else None

    def request_remove(self, job_id, token=None):
        """Request an idempotent purge without racing a worker or response stream.

        Returns True only when deletion was completed synchronously. A False
        result intentionally covers unknown, unauthorized, and deferred jobs so
        the public deletion endpoints cannot be used to probe job existence.
        """
        with self._lock:
            job = self._jobs.get(job_id)
            if token is not None and not self._authorized(job, token):
                return False
            if job is None:
                return False
            job.cancel_event.set()
            job.delete_requested = True
            if job.running or job.active_streams:
                return False
            self._jobs.pop(job_id, None)
        if job.expiry_timer is not None:
            job.expiry_timer.cancel()
        shutil.rmtree(job.workspace, ignore_errors=True)
        return True

    def remove(self, job_id):
        """Trusted/internal purge (expiry and test teardown)."""
        return self.request_remove(job_id)

    def processing_finished(self, job_id):
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.running = False
            should_remove = job.delete_requested and job.active_streams == 0
        if should_remove:
            self.request_remove(job_id)

    def begin_stream(self, job_id, token):
        """Lease a completed job so cleanup cannot delete a response mid-stream."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not self._authorized(job, token) or job.running or job.delete_requested:
                return None
            job.active_streams += 1
            return job

    def finish_stream(self, job_id, *, file_id=None, delete_job=False):
        """Release a stream, deleting its file or the whole job after completion."""
        path_to_delete = None
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if file_id is not None:
                for entry in job.files:
                    if entry["index"] == file_id:
                        path_to_delete = Path(entry["export"])
                        entry["downloaded"] = True
                        break
                for result in job.results:
                    if result.get("index") == file_id:
                        result.pop("downloadUrl", None)
                        result["downloaded"] = True
                        break
            if delete_job:
                job.delete_requested = True
            job.active_streams = max(0, job.active_streams - 1)
            remaining = any(not entry.get("downloaded") for entry in job.files)
            should_remove = job.active_streams == 0 and (job.delete_requested or not remaining)
        if path_to_delete is not None:
            path_to_delete.unlink(missing_ok=True)
        if should_remove:
            self.request_remove(job_id)

    def cleanup_expired(self):
        ttl = job_ttl_seconds()
        if ttl <= 0:
            return 0
        deadline = time.time() - ttl
        with self._lock:
            expired = [job_id for job_id, job in self._jobs.items() if job.created_at < deadline]
        for job_id in expired:
            self.request_remove(job_id)
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
