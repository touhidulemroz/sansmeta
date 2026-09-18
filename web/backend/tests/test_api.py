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


def wait_for_job(client, started, timeout=120.0):
    deadline = time.monotonic() + timeout
    status = {}
    while time.monotonic() < deadline:
        response = client.get(started["statusUrl"])
        assert response.status_code == 200, response.text
        status = response.json()
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
    started = response.json()
    status = wait_for_job(client, started)
    results = status["results"]
    assert len(results) == 1
    assert results[0]["ok"] is True
    cleaned = client.get(results[0]["downloadUrl"])
    assert cleaned.status_code == 200
    assert b"OpenAI" not in cleaned.content
    assert chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) in cleaned.content
    assert client.get(started["statusUrl"]).status_code == 404


def test_individual_download_deletes_only_delivered_file_until_batch_complete(client):
    started = upload(client, "/api/clean", [
        ("a.txt", "A\u200b".encode()),
        ("b.txt", "B\u200b".encode()),
    ]).json()
    status = wait_for_job(client, started)
    first_url, second_url = [result["downloadUrl"] for result in status["results"]]
    assert client.get(first_url).status_code == 200
    assert client.get(first_url).status_code == 404
    assert client.get(started["statusUrl"]).status_code == 200
    assert client.get(second_url).status_code == 200
    assert client.get(started["statusUrl"]).status_code == 404


def test_unknown_binary_refused(client):
    response = upload(client, "/api/inspect", [("data.bin", b"\x00\x01\x02unknown")])
    results = response.json()["results"]
    assert results[0]["ok"] is False
    assert results[0]["summary"] == "Unsupported format"

    response = upload(client, "/api/clean", [("data.bin", b"\x00\x01\x02unknown")])
    status = wait_for_job(client, response.json())
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
        ("notes.txt", "Hello\u200b world".encode()),
    ])
    started = response.json()
    job_id = started["jobId"]
    status = wait_for_job(client, started)
    assert all(result["ok"] for result in status["results"])
    zipped = client.get(started["zipUrl"])
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
        ("a.txt", "Hello\u200b".encode()),
        ("b.txt", "World\u200b".encode()),
    ])
    started = response.json()
    job_id = started["jobId"]
    # Cancel (not purge): processing stops but the job still exists.
    cancelled = client.post(f"/api/jobs/{job_id}/cancel?token={started['jobToken']}")
    assert cancelled.status_code == 200
    status = wait_for_job(client, started)
    assert status["done"] is True
    assert status["cancelled"] is True
    assert len(status["results"]) <= 1
    # The job is still present after a cancel (files are not removed yet).
    assert client.get(started["statusUrl"]).status_code == 200


def test_purge_removes_job_and_files(client):
    response = upload(client, "/api/clean", [("a.txt", "Hello\u200b".encode())])
    started = response.json()
    job_id = started["jobId"]
    wait_for_job(client, started)
    purged = client.delete(f"/api/jobs/{job_id}?token={started['jobToken']}")
    assert purged.status_code == 200
    assert purged.json()["ok"] is True
    assert purged.json()["deleted"] is True
    assert client.get(started["statusUrl"]).status_code == 404
    assert client.get(f"/api/jobs/{job_id}/files/0?token={started['jobToken']}").status_code == 404
    assert client.get(started["zipUrl"]).status_code == 404


def test_delete_is_idempotent_and_does_not_leak_existence(client):
    # Deleting an unknown job succeeds (200) rather than revealing it never existed.
    assert client.delete("/api/jobs/nope").status_code == 200
    # Repeated deletes of the same job are safe.
    response = upload(client, "/api/clean", [("a.txt", "Hello\u200b".encode())])
    started = response.json()
    job_id = started["jobId"]
    wait_for_job(client, started)
    target = f"/api/jobs/{job_id}?token={started['jobToken']}"
    assert client.delete(target).status_code == 200
    assert client.delete(target).status_code == 200
    assert client.get(started["statusUrl"]).status_code == 404


def test_unknown_job_read_endpoints_return_404(client):
    assert client.get("/api/jobs/nope/status").status_code == 404
    assert client.get("/api/jobs/nope/zip").status_code == 404


def test_job_token_prevents_cross_job_reads_and_deletion(client):
    started = upload(client, "/api/clean", [("a.txt", b"private")]).json()
    wait_for_job(client, started)
    wrong = "not-the-owner-token"
    job_id = started["jobId"]
    assert client.get(f"/api/jobs/{job_id}/status?token={wrong}").status_code == 404
    assert client.get(f"/api/jobs/{job_id}/files/0?token={wrong}").status_code == 404
    assert client.get(f"/api/jobs/{job_id}/zip?token={wrong}").status_code == 404
    # Deletes stay indistinguishable, but the wrong credential cannot remove the job.
    denied = client.delete(f"/api/jobs/{job_id}?token={wrong}")
    assert denied.status_code == 200
    assert denied.json() == {"ok": True, "deleted": False}
    assert client.get(started["statusUrl"]).status_code == 200


def test_cleanup_endpoint_purges_and_is_idempotent(client):
    response = upload(client, "/api/clean", [("a.txt", "Hello\u200b".encode())])
    started = response.json()
    job_id = started["jobId"]
    wait_for_job(client, started)
    # Best-effort cleanup (used by the page-close sendBeacon) purges the job.
    cleanup = f"/api/jobs/{job_id}/cleanup?token={started['jobToken']}"
    assert client.post(cleanup).status_code == 200
    assert client.get(started["statusUrl"]).status_code == 404
    # Repeated cleanup requests are safe and do not expose prior existence.
    assert client.post(cleanup).status_code == 200
    assert client.post("/api/jobs/nope/cleanup").status_code == 200


def test_cleanup_during_active_job_is_deferred_until_worker_finishes(client, monkeypatch):
    import pipeline

    real_clean_batch = pipeline.clean_batch

    def slow_clean_batch(job, sources, preserve_metadata=True):
        time.sleep(0.2)
        return real_clean_batch(job, sources, preserve_metadata)

    monkeypatch.setattr(pipeline, "clean_batch", slow_clean_batch)
    started = upload(client, "/api/clean", [("a.txt", b"Hello")]).json()
    job_id = started["jobId"]
    workspace = Path(__import__("main").store.get(job_id).workspace)
    cleanup = client.post(
        f"/api/jobs/{job_id}/cleanup?token={started['jobToken']}"
    )
    assert cleanup.status_code == 200
    assert cleanup.json() == {"ok": True, "deleted": False}
    assert workspace.exists(), "the worker workspace must not be deleted while active"
    deadline = time.monotonic() + 5
    while workspace.exists() and time.monotonic() < deadline:
        time.sleep(0.02)
    assert not workspace.exists()
    assert client.get(started["statusUrl"]).status_code == 404


def test_zip_download_purges_job_after_response(client, tmp_path, monkeypatch):
    base_dir = tmp_path / "jobs"
    monkeypatch.setenv("WEB_JOBS_DIR", str(base_dir))
    jobs_dir = base_dir / "sansmeta-web-jobs"
    response = upload(client, "/api/clean", [("a.txt", "Hello\u200b".encode())])
    started = response.json()
    job_id = started["jobId"]
    wait_for_job(client, started)
    # The workspace exists before the download response is produced.
    assert (jobs_dir / job_id).is_dir()
    zipped = client.get(started["zipUrl"])
    assert zipped.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zipped.content)) as archive:
        assert archive.testzip() is None
    # The job is purged once the response completes (background task), so the
    # workspace and all download endpoints are gone.
    assert client.get(started["statusUrl"]).status_code == 404
    assert not (jobs_dir / job_id).exists()


def test_fallback_expiry_removes_expired_jobs(client, tmp_path, monkeypatch):
    import main

    real_ttl = main.jobs.job_ttl_seconds
    base_dir = tmp_path / "jobs"
    monkeypatch.setenv("WEB_JOBS_DIR", str(base_dir))
    jobs_dir = base_dir / "sansmeta-web-jobs"
    # Give processing time to finish, then age the job and drive the fallback sweep.
    monkeypatch.setattr(main.jobs, "job_ttl_seconds", lambda: 30)
    try:
        response = upload(client, "/api/clean", [("a.txt", "Hello\u200b".encode())])
        started = response.json()
        job_id = started["jobId"]
        wait_for_job(client, started)
        assert (jobs_dir / job_id).is_dir()
        main.store.get(job_id).created_at = time.time() - 2
        monkeypatch.setattr(main.jobs, "job_ttl_seconds", lambda: 1)
        removed = main.store.cleanup_expired()
        assert removed >= 1
        assert client.get(started["statusUrl"]).status_code == 404
        assert not (jobs_dir / job_id).exists()
    finally:
        monkeypatch.setattr(main.jobs, "job_ttl_seconds", real_ttl)


def test_failed_immediate_cleanup_is_covered_by_fallback_expiry(client, monkeypatch):
    import main

    started = upload(client, "/api/clean", [("a.txt", b"Hello")]).json()
    wait_for_job(client, started)
    job_id = started["jobId"]
    # Simulate a cleanup request that arrives without the valid browser credential.
    response = client.post(f"/api/jobs/{job_id}/cleanup?token=wrong")
    assert response.json() == {"ok": True, "deleted": False}
    assert client.get(started["statusUrl"]).status_code == 200
    job = main.store.get(job_id)
    job.created_at = time.time() - 2
    monkeypatch.setattr(main.jobs, "job_ttl_seconds", lambda: 1)
    assert main.store.cleanup_expired() >= 1
    assert client.get(started["statusUrl"]).status_code == 404


def test_public_config_exposes_retention_without_secrets(client, monkeypatch):
    monkeypatch.setenv("WEB_JOB_TTL_SECONDS", "900")
    monkeypatch.setenv("WEB_MAX_FILE_BYTES", "12345678")
    response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert body["jobTtlSeconds"] == 900
    assert body["maxFileBytes"] == 12345678
    assert body["maxBatchFiles"] == 50
    # No secrets leak through the public config endpoint.
    assert "apiKey" not in body
    assert "api_key" not in body

    monkeypatch.setenv("WEB_JOB_TTL_SECONDS", "3600")
    assert client.get("/api/config").json()["jobTtlSeconds"] == 900


def test_office_document_round_trip(client):
    data = (ROOT / "upstream/tests/fixtures/sample_ai.xlsx").read_bytes()
    response = upload(client, "/api/clean", [("sample_ai.xlsx", data)])
    started = response.json()
    status = wait_for_job(client, started)
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


def test_home_serves_brand_and_prerendered_content(client):
    response = client.get("/")
    assert response.status_code == 200
    text = response.text
    assert "SansMeta" in text
    assert "Remove Hidden AI Metadata Online for Free" in text
    assert "Inspect and clean hidden AI metadata in your files." in text


def test_home_omits_absolute_seo_tags_without_origin(client):
    response = client.get("/")
    assert 'rel="canonical"' not in response.text
    assert 'property="og:image"' not in response.text
    assert '"url": "/"' in response.text


def test_home_injects_seo_tags_with_origin(client, monkeypatch):
    import main

    monkeypatch.setattr(main, "PUBLIC_ORIGIN", "https://example.org")
    response = client.get("/")
    assert '<link rel="canonical" href="https://example.org/">' in response.text
    assert 'property="og:title" content="SansMeta — Remove Hidden AI Metadata Online for Free"' in response.text
    assert 'content="https://example.org/og-image.png"' in response.text
    assert 'name="twitter:card" content="summary_large_image"' in response.text
    assert '"url": "https://example.org/"' in response.text


def test_privacy_page_served_with_title(client):
    response = client.get("/privacy/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<title>Privacy — SansMeta</title>" in response.text
    assert "server" in response.text.lower()


def test_privacy_url_redirects(client):
    assert client.get("/privacy", follow_redirects=False).status_code == 301
    assert client.get("/privacy.html", follow_redirects=False).status_code == 301
    assert client.get("/index.html", follow_redirects=False).status_code == 301


def test_robots_txt(client):
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "User-agent: *" in response.text
    assert "Disallow: /api/" in response.text


def test_sitemap_requires_configured_origin(client):
    assert client.get("/sitemap.xml").status_code == 404


def test_sitemap_with_origin(client, monkeypatch):
    import main

    monkeypatch.setattr(main, "PUBLIC_ORIGIN", "https://example.org")
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "<loc>https://example.org/</loc>" in response.text
    assert "<loc>https://example.org/privacy/</loc>" in response.text
    assert "/api/" not in response.text


def test_api_responses_are_no_store_and_noindex(client):
    response = client.get("/api/health")
    assert response.headers["cache-control"] == "no-store"
    assert "noindex" in response.headers["x-robots-tag"]


def test_missing_page_serves_custom_404_html(client):
    response = client.get("/definitely-not-here")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert "Page not found" in response.text


def test_missing_api_route_keeps_json_404(client):
    response = client.get("/api/definitely-not-here")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_cors_default_wildcard_on_api(client, monkeypatch):
    monkeypatch.delenv("WEB_CORS_ORIGINS", raising=False)
    response = client.get("/api/health", headers={"Origin": "https://sansmeta-web.onrender.com"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    expose = response.headers.get("access-control-expose-headers", "").lower()
    assert "content-disposition" in expose
    assert "content-length" in expose


def test_cors_preflight_options_request(client, monkeypatch):
    monkeypatch.delenv("WEB_CORS_ORIGINS", raising=False)
    response = client.options(
        "/api/clean",
        headers={
            "Origin": "https://sansmeta-web.onrender.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_cors_configured_allowed_origins(client, monkeypatch):
    monkeypatch.setenv("WEB_CORS_ORIGINS", "https://sansmeta-web.onrender.com,https://sansmeta.com")
    allowed_resp = client.get("/api/health", headers={"Origin": "https://sansmeta-web.onrender.com"})
    assert allowed_resp.status_code == 200
    assert allowed_resp.headers.get("access-control-allow-origin") == "https://sansmeta-web.onrender.com"
    assert "Origin" in allowed_resp.headers.get("vary", "")

    second_allowed = client.get("/api/health", headers={"Origin": "https://sansmeta.com"})
    assert second_allowed.status_code == 200
    assert second_allowed.headers.get("access-control-allow-origin") == "https://sansmeta.com"

    disallowed_resp = client.get("/api/health", headers={"Origin": "https://unauthorized-domain.com"})
    assert disallowed_resp.status_code == 200
    assert "access-control-allow-origin" not in disallowed_resp.headers


def test_cors_headers_on_job_deletion_and_cleanup(client, monkeypatch):
    monkeypatch.setenv("WEB_CORS_ORIGINS", "https://sansmeta-web.onrender.com")
    origin = "https://sansmeta-web.onrender.com"
    response = client.delete("/api/jobs/unknown-job", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin

    cleanup_resp = client.post("/api/jobs/unknown-job/cleanup", headers={"Origin": origin})
    assert cleanup_resp.status_code == 200
    assert cleanup_resp.headers.get("access-control-allow-origin") == origin
