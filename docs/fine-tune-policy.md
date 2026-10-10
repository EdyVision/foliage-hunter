# Foliage fine-tune policy (Colorado-first, Ray → Spark)

**Mac prepares → Ray Jobs API over Tailscale → Spark GPU runs the snapshot.**

`sync_to_spark.sh` is optional (persistent checkout). It is **not** how training
ships. Ray uploads the working tree with the job.

## Submit

```bash
# scripts/remote.env — DGX_RAY_ADDRESS / DGX_DASHBOARD_URL (Tailscale Magic DNS)
./scripts/submit_ray_lora.sh
```

Ray excludes `.env`, `node_modules`, `.expo`, `artifacts`. Spark-local `.env` /
NAS weights stay on the worker.

## Species / corpus

See `configs/colorado_priority_species.json`.

```bash
python3 scripts/build_inat_corpus.py \
  --species configs/colorado_priority_species.json \
  --out data/foliage --per-species 80
```

Images under `data/foliage/images/` are gitignored. For large packs, park them
on NAS and point `DATASET_PATH` there so Ray only uploads labels + code.

## Train

- Base: multimodal Gemma on `/mnt/nas/models/hf/…` (current: `google/gemma-3-12b-it`)
- LoRA / PEFT entry: `scripts/ray/foliage_lora_job.py`
- Pause vLLM if VRAM is full before submitting

## Full pack (current)

- 80 images × 18 species (~1440), stratified ~80/20 train/eval
- Closed-set prompt; label-mask answer tokens only
- Defaults: `MAX_STEPS=600`, `LORA_R=16`
- Held-out generate-and-match: `scripts/ray/foliage_eval_job.py` → **85.1%** (245/288)

## Privacy

No lab hostnames in the Expo app or public Hub cards. Logical app id
`gemma-foliage` only. Do **not** publish NC image bytes; publish observation
IDs, licenses, and rebuild instructions instead.

## Hugging Face release

What we trained is a **PEFT LoRA adapter** (~284 MB), not a full model. Cite
`google/gemma-3-12b-it` as the base; do not re-upload base weights.

| Artifact | HF type | Suggested repo | Contents |
|----------|---------|----------------|----------|
| Adapter bucket | Model | `EdyVision/foliage-hunter-gemma3-12b` | `adapters/colorado_v1/` (adapter weights + config, `species_catalog.json`, train pin, SHA manifest) |
| Experiments | Dataset | `EdyVision/foliage-hunter-experiments` | held-out methodology, `eval_results.json`, split manifests, observation ID lists, license notes, iNat citation |
| Merged weights | Model (optional later) | `EdyVision/foliage-hunter-gemma3-12b-merged` | only if LoRA is baked into base for no-PEFT serve; skip unless needed |

**Published (public):**
- https://huggingface.co/EdyVision/foliage-hunter-gemma3-12b
- https://huggingface.co/datasets/EdyVision/foliage-hunter-experiments


Card should state: base model + Gemma terms, LoRA r=16 / closed-set 18 spp /
600 steps, stratified hold-out (288 images), accuracy 85.1%, corpus =
iNaturalist research-grade via API (observation IDs only publicly).
