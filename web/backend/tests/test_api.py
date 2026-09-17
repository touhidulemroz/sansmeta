import io
import struct
import time
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def marked_png_bytes():
    pixels = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"tEXt", b"Software\x00OpenAI DALL-E")
            + pixels + chunk(b"IEND", b""))


def upload(client, path, files, preserve="true"):
    return client.post(
        path,
        data={"preserveMetadata": preserve},
        files=[("files", (name, data, "application/octet-stream")) for name, data in files],
    )


def wait_for_job(client, job_id, timeout=120.0):
    deadline = time.monotonic() + timeout
    status = {}
    while time.monotonic() < deadline:
        status = client.get(f"/api/jobs/{job_id}/status").json()
        if status["done"]:
            assert status["error"] is None, status["error"]
            return status
        time.sleep(0.2)
    raise AssertionError(f"job did not finish in time; last status: {status}")


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_text_cleanup_preserves_bengali_and_emoji(client):
    original = "Hello\u200b world\u00a0বাংলা ❤️‍🔥"
    response = client.post("/api/text", json={"text": original})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["text"] == "Hello world বাংলা ❤️‍🔥"
    assert body["summary"] == "1 removed · 1 replaced"


def test_text_over_limit_rejected(client, monkeypatch):
    monkeypatch.setenv("WEB_MAX_TEXT_BYTES", "10")
    response = client.post("/api/text", json={"text": "x" * 20})
    assert response.status_code == 413


def test_inspect_marks_found_on_marked_png(client):
    response = upload(client, "/api/inspect", [("image.png", marked_png_bytes())])
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["ok"] is True
    assert results[0]["summary"] == "Marks found"
    assert results[0]["report"]["kind"] == "image"


def test_inspect_marks_found_on_upstream_fixture(client):
    data = (ROOT / "upstream/tests/fixtures/sample_watermarked.txt").read_bytes()
    response = upload(client, "/api/inspect", [("sample_watermarked.txt", data)])
    results = response.json()["results"]
    assert results[0]["ok"] is True
    assert results[0]["summary"] == "Marks found"


def test_clean_png_download_keeps_pixel_data(client):
    response = upload(client, "/api/clean", [("image.png", marked_png_bytes())])
    assert response.status_code == 200
    job_id = response.json()["jobId"]
    status = wait_for_job(client, job_id)
    results = status["results"]
    assert len(results) == 1
    assert results[0]["ok"] is True
    cleaned = client.get(results[0]["downloadUrl"])
    assert cleaned.status_code == 200
    assert b"OpenAI" not in cleaned.content
    assert chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) in cleaned.content


def test_unknown_binary_refused(client):
    response = upload(client, "/api/inspect", [("data.bin", b"\x00\x01\x02unknown")])
    results = response.json()["results"]
    assert results[0]["ok"] is False
    assert results[0]["summary"] == "Unsupported format"

    response = upload(client, "/api/clean", [("data.bin", b"\x00\x01\x02unknown")])
    status = wait_for_job(client, response.json()["jobId"])
    assert status["results"][0]["ok"] is False


def test_file_over_limit_rejected(client, monkeypatch):
    monkeypatch.setenv("WEB_MAX_FILE_BYTES", "1024")
    response = upload(client, "/api/inspect", [("big.bin", b"x" * 4096)])
    assert response.status_code == 413


def test_too_many_files_rejected(client):
    files = [(f"f{i}.txt", b"plain") for i in range(51)]
    response = upload(client, "/api/inspect", files)
    assert response.status_code == 413


def test_batch_zip_and_duplicate_names_never_overwrite(client):
    png = marked_png_bytes()
    response = upload(client, "/api/clean", [
        ("image.png", png),
        ("image.png", png),
        ("notes.txt", b"Hello\u200b world"),
    ])
    job_id = response.json()["jobId"]
    status = wait_for_job(client, job_id)
    assert all(result["ok"] for result in status["results"])
    zipped = client.get(f"/api/jobs/{job_id}/zip")
    assert zipped.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zipped.content)) as archive:
        assert sorted(archive.namelist()) == [
            "image.cleaned-2.png",
            "image.cleaned.png",
            "notes.cleaned.txt",
        ]
        assert archive.testzip() is None


def test_cancel_stops_after_current_file(client, monkeypatch):
    import pipeline
    real_clean_batch = pipeline.clean_batch

    def slow_clean_batch(job, sources, preserve_metadata=True):
        time.sleep(0.4)
        return real_clean_batch(job, sources, preserve_metadata)

    monkeypatch.setattr(pipeline, "clean_batch", slow_clean_batch)
    response = upload(client, "/api/clean", [
        ("a.txt", b"Hello\u200b"),
        ("b.txt", b"World\u200b"),
    ])
    job_id = response.json()["jobId"]
    client.delete(f"/api/jobs/{job_id}")
    status = wait_for_job(client, job_id)
    assert status["done"] is True
    assert status["cancelled"] is True
    assert len(status["results"]) <= 1


def test_purge_removes_job_and_files(client):
    response = upload(client, "/api/clean", [("a.txt", b"Hello\u200b")])
    job_id = response.json()["jobId"]
    wait_for_job(client, job_id)
    purged = client.delete(f"/api/jobs/{job_id}", params={"purge": "true"})
    assert purged.status_code == 200
    assert purged.json()["purged"] is True
    assert client.get(f"/api/jobs/{job_id}/status").status_code == 404
    assert client.get(f"/api/jobs/{job_id}/files/0").status_code == 404
    assert client.get(f"/api/jobs/{job_id}/zip").status_code == 404


def test_unknown_job_returns_404(client):
    assert client.get("/api/jobs/nope/status").status_code == 404
    assert client.get("/api/jobs/nope/zip").status_code == 404
    assert client.delete("/api/jobs/nope").status_code == 404


def test_office_document_round_trip(client):
    data = (ROOT / "upstream/tests/fixtures/sample_ai.xlsx").read_bytes()
    response = upload(client, "/api/clean", [("sample_ai.xlsx", data)])
    job_id = response.json()["jobId"]
    status = wait_for_job(client, job_id)
    assert status["results"][0]["ok"] is True
    cleaned = client.get(status["results"][0]["downloadUrl"])
    with zipfile.ZipFile(io.BytesIO(cleaned.content)) as archive:
        assert archive.testzip() is None
        assert "xl/workbook.xml" in archive.namelist()


def test_api_key_enforced_when_configured(client, monkeypatch):
    monkeypatch.setenv("WEB_API_KEY", "secret")
    assert client.get("/api/health").status_code == 200
    assert client.post("/api/text", json={"text": "hi"}).status_code == 401
    authorized = client.post(
        "/api/text",
        json={"text": "hi"},
        headers={"Authorization": "Bearer secret"},
    )
    assert authorized.status_code == 200
