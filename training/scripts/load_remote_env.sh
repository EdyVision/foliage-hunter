#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/scripts/remote.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy scripts/remote.env.example (Ray address over Tailscale)." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

# Ray-first: dashboard or ray:// address is enough
if [[ -z "${DGX_DASHBOARD_URL:-}" && -z "${DGX_RAY_ADDRESS:-}" && -z "${REMOTE_HOST:-}" ]]; then
  echo "Set DGX_DASHBOARD_URL / DGX_RAY_ADDRESS (preferred) or REMOTE_HOST in ${ENV_FILE}" >&2
  exit 1
fi
