"""JSON-over-stdio client for the unchanged Mac app adapter (app/bridge.py)."""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE = REPO_ROOT / "app" / "bridge.py"
PER_FILE_TIMEOUT_SECONDS = 200.0


def run(request, timeout=PER_FILE_TIMEOUT_SECONDS):
    """Send one request to bridge.py and return its JSON response."""
    payload = json.dumps(request, ensure_ascii=False)
    result = subprocess.run(
        [sys.executable, str(BRIDGE)],
        input=payload, capture_output=True, text=True, timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "The adapter failed to start.")
    try:
        return json.loads(result.stdout)
    except ValueError:
        raise RuntimeError(
            result.stderr.strip() or result.stdout.strip() or "The adapter returned no report."
        ) from None
