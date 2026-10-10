# Serving `gemma-foliage` (lab path)

How Foliage Hunter inference fits the same stack as the rest of the lab.

## How the lab usually serves models

```text
Phone / Expo / Open WebUI
        │
        ▼
   LiteLLM (tower)     ← only public alias clients know: gemma-foliage
        │
        ▼
   Spark GPU worker    ← vLLM (Docker) on LAN :800x
        │
        ▼
   Weights on NAS      ← /mnt/nas/models/hf/… + registry.json
```

| Piece | Role |
|-------|------|
| **NAS + `registry.json`** | Canonical weight location and catalog (org/name → path, aliases) |
| **Spark Docker (vLLM)** | Loads base (and optional LoRA) into GPU; OpenAI `/v1` on a LAN port |
| **LiteLLM** | Stable alias → `api_base` on Spark; apps never hardcode Spark IPs |
| **Apps** | Call LiteLLM with `EXPO_PUBLIC_GUIDE_MODEL=gemma-foliage` |

Existing Spark trials follow this: `spark-vllm` (:8000), `spark-qwen-coder-trial` (:8001), `spark-gemma4-coder-trial` (:8002). Only one heavy GPU backend should be up at a time.

## What is different for Foliage

Foliage is not a full base checkpoint. It is a **PEFT LoRA adapter** on
`google/gemma-3-12b-it` (published at `EdyVision/foliage-hunter-gemma3-12b`,
`adapters/colorado_v1`).

So serving needs:

1. **Base** on NAS: `/mnt/nas/models/hf/google/gemma-3-12b-it`
2. **Adapter** on NAS (preferred) or Spark home during bring-up
3. A Spark process that loads **base + adapter** and speaks OpenAI chat (with images)
4. LiteLLM alias `gemma-foliage` → that Spark `api_base`

Registry entry (alias `gemma-foliage`) should point at the adapter path + base path.
That is the same registry used for other HF snapshots; the `kind` is
`peft_lora_adapter` instead of a full model.

## Preferred bring-up (match other trials)

On Spark (sudo for Docker + NAS stage):

```bash
# 1) Stage adapter onto NAS (once)
sudo mkdir -p /mnt/nas/models/hf/EdyVision/foliage-hunter-gemma3-12b/adapters/colorado_v1
sudo rsync -a ~/foliage-hunter-artifacts/foliage-lora/ \
  /mnt/nas/models/hf/EdyVision/foliage-hunter-gemma3-12b/adapters/colorado_v1/
# keep adapter_config base_model_name_or_path = google/gemma-3-12b-it

# 2) Free GPU (same as other trials)
sudo docker stop spark-vllm spark-qwen-coder-trial spark-gemma4-coder-trial 2>/dev/null || true

# 3) Start a foliage trial compose (vLLM with --enable-lora), OR the PEFT
#    OpenAI helper in ~/foliage-hunter-serve until the vLLM compose lands.
```

On the tower (LiteLLM already has `gemma-foliage` → `http://<spark-lan-ip>:8003/v1`
in `deploy/compose/ai/litellm/config.yaml`):

```bash
cd /path/to/your/litellm/compose
docker compose up -d --force-recreate litellm
curl -sS http://127.0.0.1:4000/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  | jq '.data[].id' | grep gemma-foliage
```

## Temporary PEFT helper (why it exists)

`guide-server/` is a small FastAPI OpenAI shim that loads transformers+PEFT the
same way the 85.1% eval did. It is useful when:

- NAS staging needs sudo and is not done yet
- vLLM multimodal + LoRA bring-up is still being pinned for Gemma 3 on GB10

It is **not** a second architecture. Clients still go through LiteLLM; only the
Spark worker process differs until the Docker trial matches `gemma4-coder-trial`.

```bash
# on Spark, GPU free
guide-server/start_foliage_serve.sh (on Spark checkout)   # :8003
curl -fsS http://127.0.0.1:8003/health
```

## App

```bash
# mobile/.env — your OpenAI-compatible gateway (reachable from the phone)
EXPO_PUBLIC_GUIDE_URL=
EXPO_PUBLIC_GUIDE_MODEL=gemma-foliage
EXPO_PUBLIC_GUIDE_API_KEY=
EXPO_PUBLIC_TTS_URL=
EXPO_PUBLIC_TTS_MODEL=magpie-tts
EXPO_PUBLIC_TTS_VOICE=
```

Without `GUIDE_URL` / `TTS_URL`, the app falls back to device TTS.

## Public artifacts (unchanged)

- Adapter: https://huggingface.co/EdyVision/foliage-hunter-gemma3-12b
- Experiments: https://huggingface.co/datasets/EdyVision/foliage-hunter-experiments
- Base: https://huggingface.co/google/gemma-3-12b-it
