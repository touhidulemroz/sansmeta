import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WEB_JOBS_DIR", str(tmp_path / "jobs"))
    monkeypatch.setenv("WEB_JOB_TTL_SECONDS", "900")
    import main
    from fastapi.testclient import TestClient

    with TestClient(main.app) as test_client:
        yield test_client
