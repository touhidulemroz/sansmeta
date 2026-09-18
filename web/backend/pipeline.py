"""Batch loops mirroring the Mac app's orchestration (WatermarksApp.swift)."""
import bridge_client


def inspect_batch(sources, cancel_event, preserve_metadata=True):
    """Run bridge inspect per file; returns (results, cancelled)."""
    results = []
    for source in sources:
        if cancel_event.is_set():
            return results, True
        response = bridge_client.run({
            "action": "inspect",
            "path": str(source),
            "preserveMetadata": bool(preserve_metadata),
        })
        results.append({
            "name": source.name,
            "ok": bool(response.get("ok")),
            "summary": response.get("summary", ""),
            "report": response.get("report"),
        })
    return results, False


def clean_batch(job, sources, preserve_metadata=True):
    """Run bridge clean per file into job.exports; records entries on the job."""
    results = []
    for index, source in enumerate(sources):
        if job.cancel_event.is_set():
            return results, True
        response = bridge_client.run({
            "action": "clean",
            "path": str(source),
            "outputDirectory": str(job.exports),
            "preserveMetadata": bool(preserve_metadata),
        })
        entry = {
            "index": index,
            "name": source.name,
            "ok": bool(response.get("ok")),
            "summary": response.get("summary", ""),
        }
        export = response.get("output")
        if entry["ok"] and export:
            entry["warning"] = bool(response.get("warning"))
            entry["downloadUrl"] = f"/api/jobs/{job.id}/files/{index}?token={job.token}"
            entry["report"] = response.get("report")
            job.files.append({"index": index, "name": source.name, "export": export})
        else:
            entry["report"] = None
        results.append(entry)
    return results, False
