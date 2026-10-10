#!/usr/bin/env bash
# Start foliage LoRA OpenAI server on Spark (no Docker).
# Run on the GPU host (port 8003). Needs a free GPU (stop other vLLM containers first).
set -euo pipefail

PY="${FOLIAGE_PY:-python3}"
ADAPTER="${ADAPTER_DIR:-$HOME/foliage-hunter-artifacts/foliage-lora}"
BASE="${BASE_MODEL_ID:-/mnt/nas/models/hf/google/gemma-3-12b-it}"
PORT="${PORT:-8003}"
LOG="${LOG:-$HOME/foliage-hunter-serve/serve.log}"
PIDFILE="${PIDFILE:-$HOME/foliage-hunter-serve/serve.pid}"

mkdir -p "$(dirname "$LOG")"
# stop previous
if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "already running pid=$(cat "$PIDFILE")"
  exit 0
fi

# ensure fastapi/uvicorn present
"$PY" -c "import fastapi,uvicorn" 2>/dev/null || "$PY" -m pip install -q fastapi uvicorn

export BASE_MODEL_ID="$BASE"
export ADAPTER_DIR="$ADAPTER"
export SERVED_MODEL="${SERVED_MODEL:-gemma-foliage}"
export HOST=0.0.0.0
export PORT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
nohup "$PY" "$SCRIPT_DIR/foliage_openai_server.py" >"$LOG" 2>&1 &
echo $! >"$PIDFILE"
echo "started pid=$(cat "$PIDFILE") log=$LOG"
echo "wait for health: curl -fsS http://127.0.0.1:${PORT}/health"
