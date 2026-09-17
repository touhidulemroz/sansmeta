"""Offline adapter for the unmodified upstream command-line tools."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
SCRIPTS = ROOT / "engine" / "scripts"
if not SCRIPTS.exists():
    SCRIPTS = ROOT.parent / "upstream" / "service" / "scripts"


def invoke(script, args):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / script), *args, "--json"],
        capture_output=True, text=True, timeout=180,
    )
    try:
        report = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "The engine returned no report.")
    return result.returncode, report, result.stderr.strip()


def export_copy(staged, source, directory):
    """Reserve the destination exclusively, including across concurrent app runs."""
    directory = Path(directory)
    if not directory.is_dir():
        raise ValueError("Choose an existing output folder.")
    source = Path(source)
    for n in range(1, 10000):
        suffix = "" if n == 1 else f"-{n}"
        target = directory / f"{source.stem}.cleaned{suffix}{source.suffix}"
        try:
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            continue
        try:
            with os.fdopen(fd, "wb") as out, open(staged, "rb") as incoming:
                shutil.copyfileobj(incoming, out)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return str(target)
    raise RuntimeError("Too many existing cleaned copies in this folder.")


def handle(request):
    action = request["action"]
    if action == "text":
        sys.path.insert(0, str(SCRIPTS))
        from text_unicode import clean_text
        text = request.get("text", "")
        if len(text.encode("utf-8")) > 8 * 1024 * 1024:
            raise ValueError("Paste less than 8 MB of text at a time.")
        cleaned, stats = clean_text(text)
        return {"ok": True, "text": cleaned, "report": stats,
                "summary": f"{stats['removed_count']} removed · {stats['replaced_count']} replaced"}
    source = Path(request["path"]).resolve(strict=True)
    if not source.is_file():
        raise ValueError("Please choose a file, not a folder.")
    if action == "inspect":
        code, report, stderr = invoke("inspect_file.py", [str(source)])
        if code not in (0, 1):
            raise RuntimeError(stderr or "Inspection failed.")
        unknown = report.get("kind") == "unknown"
        return {"ok": not unknown, "report": report,
                "summary": "Unsupported format" if unknown else "Marks found" if code else "No marks detected"}
    if action != "clean":
        raise ValueError("Unknown action.")
    with tempfile.TemporaryDirectory(prefix="watermarks-clean-") as temp:
        staged = Path(temp) / source.name
        args = [str(source), "-o", str(staged)]
        if request.get("preserveMetadata", True):
            args.append("--keep-non-ai-metadata")
        code, report, stderr = invoke("clean_file.py", args)
        if code not in (0, 1) or not staged.is_file():
            raise RuntimeError(stderr or "No cleaned file was produced.")
        destination = export_copy(staged, source, request["outputDirectory"])
        report["output"] = destination
        warning = (code != 0 or bool(report.get("warnings"))
                   or bool(report.get("still_has_c2pa")) or bool(report.get("still_has_ai_metadata"))
                   or bool(report.get("meta", {}).get("degraded"))
                   or any("warning:" in str(action).lower() for action in report.get("actions", [])))
        return {"ok": True, "warning": warning, "output": destination, "report": report,
                "summary": "Saved · review warnings" if warning else "Cleaned copy saved" if report.get("changed", True) else "Unchanged copy saved"}


if __name__ == "__main__":
    try:
        response = handle(json.load(sys.stdin))
    except Exception as error:
        response = {"ok": False, "summary": str(error)}
    print(json.dumps(response, ensure_ascii=False))
