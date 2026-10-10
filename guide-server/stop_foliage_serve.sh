#!/usr/bin/env bash
set -euo pipefail
PIDFILE="${PIDFILE:-$HOME/foliage-hunter-serve/serve.pid}"
if [[ -f "$PIDFILE" ]]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "stopped"
else
  echo "no pidfile"
fi
