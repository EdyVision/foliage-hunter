"""Held-out generate-and-match eval for the foliage LoRA adapter."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import torch
from peft import PeftModel
from PIL import Image
from transformers import AutoModelForImageTextToText, AutoProcessor


def _disable_broken_torch_native_triton() -> None:
    try:
        from torch._native.registry import deregister_op_overrides

        deregister_op_overrides(disable_dsl_names=["triton"])
    except Exception as exc:  # noqa: BLE001
        print(f"warn: could not disable torch._native triton ({exc})")


def _norm(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s\-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _match(pred: str, label: str) -> bool:
    p, l = _norm(pred), _norm(label)
    if not p or not l:
        return False
    if p == l:
        return True
    # allow "quaking aspen" vs "aspen" / substring either way
    if l in p or p in l:
        return True
    return False


def main() -> None:
    base_model = os.environ.get(
        "BASE_MODEL_ID", "/mnt/nas/models/hf/google/gemma-3-12b-it"
    )
    adapter = Path(
        os.environ.get(
            "ADAPTER_DIR",
            os.path.expanduser("~/foliage-hunter-artifacts/foliage-lora"),
        )
    )
    dataset_root = Path(
        os.environ.get("DATASET_PATH", os.path.expanduser("~/foliage-hunter-data"))
    )
    out_path = Path(
        os.environ.get(
            "EVAL_OUT",
            os.path.expanduser("~/foliage-hunter-artifacts/foliage-lora/eval_results.json"),
        )
    )

    eval_path = dataset_root / "eval.jsonl"
    if not eval_path.is_file():
        raise SystemExit(f"Missing {eval_path}")
    if not adapter.is_dir():
        raise SystemExit(f"Missing adapter {adapter}")

    rows = []
    with eval_path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            img = dataset_root / row["image"]
            if img.is_file():
                rows.append(row | {"image_path": str(img)})

    if not rows:
        raise SystemExit("No eval rows with images")

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required")
    _disable_broken_torch_native_triton()

    print(f"Eval {len(rows)} images | base={base_model} | adapter={adapter}")
    processor = AutoProcessor.from_pretrained(base_model, trust_remote_code=True)
    model = AutoModelForImageTextToText.from_pretrained(
        base_model,
        dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()

    catalog_path = adapter / "species_catalog.json"
    if catalog_path.is_file():
        catalog = json.loads(catalog_path.read_text()).get("species") or []
    else:
        catalog = sorted({(r.get("species") or "") for r in rows if r.get("species")})
    choices = ", ".join(catalog)
    prompt = (
        "Identify the plant in the photo.\n"
        f"Choose exactly one common name from this list: {choices}.\n"
        "Reply with that common name only. No punctuation, no extra words."
    )

    results = []
    hits = 0
    for i, row in enumerate(rows):
        image = Image.open(row["image_path"]).convert("RGB")
        label = row.get("species") or row.get("scientific") or ""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        text = processor.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=False
        )
        enc = processor(text=[text], images=[image], return_tensors="pt").to(
            model.device
        )
        with torch.inference_mode():
            out = model.generate(**enc, max_new_tokens=32, do_sample=False)
        # decode only new tokens
        gen = out[0][enc["input_ids"].shape[-1] :]
        pred = processor.decode(gen, skip_special_tokens=True).strip()
        ok = _match(pred, label)
        hits += int(ok)
        rec = {
            "i": i,
            "label": label,
            "pred": pred,
            "correct": ok,
            "image": row["image"],
            "scientific": row.get("scientific"),
        }
        results.append(rec)
        print(f"[{i+1}/{len(rows)}] {'HIT' if ok else 'MISS'} label={label!r} pred={pred!r}")

    acc = hits / len(rows)
    summary = {
        "n": len(rows),
        "hits": hits,
        "accuracy": round(acc, 4),
        "base_model": base_model,
        "adapter": str(adapter),
        "results": results,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(f"ACCURACY {hits}/{len(rows)} = {acc:.1%}")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
