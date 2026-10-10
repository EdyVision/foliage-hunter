#!/usr/bin/env bash
# Submit foliage LoRA to Spark via Ray Jobs API over Tailscale.
set -euo pipefail

TRAINING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${TRAINING_ROOT}/scripts/load_remote_env.sh"

DASHBOARD="${DGX_DASHBOARD_URL:-}"
if [[ -z "${DASHBOARD}" && -n "${DGX_RAY_ADDRESS:-}" ]]; then
  hostport="${DGX_RAY_ADDRESS#ray://}"
  host="${hostport%%:*}"
  DASHBOARD="http://${host}:8265"
fi
if [[ -z "${DASHBOARD}" ]]; then
  echo "Set DGX_DASHBOARD_URL or DGX_RAY_ADDRESS in training/scripts/remote.env" >&2
  exit 1
fi

HOST="${DGX_RSYNC_HOST:-${DGX_HOST:-}}"
if [[ -z "${HOST}" && -n "${DGX_RAY_ADDRESS:-}" ]]; then
  HOST="${DGX_RAY_ADDRESS#ray://}"
  HOST="${HOST%%:*}"
fi

RAY_BIN="${RAY_BIN:-}"
if [[ -z "${RAY_BIN}" ]]; then
  if command -v ray >/dev/null 2>&1; then
    RAY_BIN="$(command -v ray)"
  fi
fi
[[ -n "${RAY_BIN}" ]] || { echo "No ray CLI on PATH (pip install \"ray[default]\" or set RAY_BIN)" >&2; exit 1; }

# Python on the Ray worker that has torch/transformers/peft (set in scripts/remote.env).
WORKER_PY="${DGX_WORKER_PYTHON:-python3}"
REMOTE_USER="${DGX_REMOTE_USER:-$USER}"

REMOTE_DATA="${FOLIAGE_REMOTE_DATA:-foliage-hunter-data}"   # relative to the remote home
if [[ -n "${HOST}" && -d "${TRAINING_ROOT}/data/foliage/images" ]]; then
  echo "==> rsync corpus → ${REMOTE_USER}@${HOST}:${REMOTE_DATA}"
  ssh -o BatchMode=yes "${REMOTE_USER}@${HOST}" "mkdir -p ${REMOTE_DATA}"
  rsync -az --delete \
    "${TRAINING_ROOT}/data/foliage/train.jsonl" \
    "${TRAINING_ROOT}/data/foliage/eval.jsonl" \
    "${TRAINING_ROOT}/data/foliage/manifest.json" \
    "${REMOTE_USER}@${HOST}:${REMOTE_DATA}/"
  rsync -az --delete "${TRAINING_ROOT}/data/foliage/images/" "${REMOTE_USER}@${HOST}:${REMOTE_DATA}/images/"
fi

ENTRY="${1:-ray/foliage_lora_job.py}"
export BASE_MODEL_ID="${BASE_MODEL_ID:-/mnt/nas/models/hf/google/gemma-3-12b-it}"
export DATASET_PATH="${DATASET_PATH:-${REMOTE_DATA}}"
export OUTPUT_ADAPTER_DIR="${OUTPUT_ADAPTER_DIR:-foliage-hunter-artifacts/foliage-lora}"
export MAX_STEPS="${MAX_STEPS:-600}"
export LORA_R="${LORA_R:-16}"

echo "==> Ray job submit via ${DASHBOARD}"
echo "    python: ${WORKER_PY}"
echo "    entry:  ${ENTRY}"
echo "    base:   ${BASE_MODEL_ID}"
echo "    data:   ${DATASET_PATH}"
echo "    cwd:    ${TRAINING_ROOT}"

RUNTIME_ENV=$(cat <<JSON
{"py_executable":"${WORKER_PY}","env_vars":{"BASE_MODEL_ID":"${BASE_MODEL_ID}","DATASET_PATH":"${DATASET_PATH}","OUTPUT_ADAPTER_DIR":"${OUTPUT_ADAPTER_DIR}","MAX_STEPS":"${MAX_STEPS}","LORA_R":"${LORA_R}","HF_HOME":"/mnt/nas/models/hf","TRANSFORMERS_CACHE":"/mnt/nas/models/hf"},"excludes":[".git",".venv","artifacts",".env","scripts/remote.env","data/foliage/images","data/foliage/raw"]}
JSON
)

"${RAY_BIN}" job submit \
  --address "${DASHBOARD}" \
  --working-dir "${TRAINING_ROOT}" \
  --runtime-env-json "${RUNTIME_ENV}" \
  --entrypoint-num-gpus 1 \
  --no-wait \
  -- "${WORKER_PY}" "${ENTRY}"
