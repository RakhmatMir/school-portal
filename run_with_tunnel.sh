#!/usr/bin/env bash
# Запуск портала + cloudflared с автоперезапуском при падении.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
LOG_DIR="${LOG_DIR:-./logs}"
mkdir -p "$LOG_DIR"
URL_FILE="${URL_FILE:-$LOG_DIR/tunnel-url.txt}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Установите cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

start_server() {
  while true; do
    echo "[portal] uvicorn on :$PORT"
    python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT" || true
    sleep 2
  done
}

start_tunnel() {
  while true; do
    echo "[tunnel] cloudflared quick tunnel → http://127.0.0.1:$PORT"
    cloudflared tunnel --url "http://127.0.0.1:$PORT" 2>&1 | tee "$LOG_DIR/cloudflared.log" | while read -r line; do
      if [[ "$line" =~ https://[a-z0-9-]+\.trycloudflare\.com ]]; then
        echo "${BASH_REMATCH[0]}" > "$URL_FILE"
        echo "[tunnel] Актуальная ссылка: ${BASH_REMATCH[0]}"
      fi
      echo "$line"
    done
    sleep 5
  done
}

start_server &
start_tunnel &
wait
