#!/usr/bin/env bash
# OPTIONAL. Persistent checkout on Spark only.
# Preferred path: ./training/scripts/submit_ray_lora.sh
set -euo pipefail

TRAINING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${TRAINING_ROOT}/.." && pwd)"
# shellcheck disable=SC1091
source "${TRAINING_ROOT}/scripts/load_remote_env.sh"

SSH_OPTS=(-o IPQoS=none -o ServerAliveInterval=15 -o ConnectTimeout=20)

echo "==> ensure remote checkout"
ssh "${SSH_OPTS[@]}" "${REMOTE_HOST}" "mkdir -p '${REMOTE_DEST}'"

echo "==> rsync training + guide-server"
rsync -avz \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.venv/' \
  --exclude 'node_modules/' \
  --exclude '.expo/' \
  --exclude '/artifacts/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'scripts/remote.env' \
  --exclude '__pycache__/' \
  "${REPO_ROOT}/training/" "${REMOTE_HOST}:${REMOTE_DEST}/training/"

rsync -avz \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '__pycache__/' \
  "${REPO_ROOT}/guide-server/" "${REMOTE_HOST}:${REMOTE_DEST}/guide-server/"

echo "==> sync_ok"
ssh "${SSH_OPTS[@]}" "${REMOTE_HOST}" \
  "cd '${REMOTE_DEST}' && test -f training/configs/colorado_priority_species.json && echo ok"
