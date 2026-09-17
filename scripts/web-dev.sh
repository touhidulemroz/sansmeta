#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -x "$ROOT/web/backend/.venv/bin/uvicorn" ]; then
  echo "Backend venv missing. Run: cd web/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
if [ ! -d "$ROOT/web/frontend/node_modules" ]; then
  echo "Frontend deps missing. Run: cd web/frontend && npm install"
  exit 1
fi

cd "$ROOT/web/backend"
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

cd "$ROOT/web/frontend"
npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!

trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true' INT TERM EXIT
wait "$BACKEND_PID" "$FRONTEND_PID"
