#!/usr/bin/env bash
# Автозапуск портала в Cloud Agent (start phase).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

if curl -sf "http://127.0.0.1:${PORT}/api/public/landing" >/dev/null 2>&1; then
  echo "[portal] already running on :${PORT}"
  exit 0
fi

python3 scripts/print_portal_urls.py
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
