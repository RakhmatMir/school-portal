#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PORT="${PORT:-8080}"
python3 scripts/print_portal_urls.py
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
