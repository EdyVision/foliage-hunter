"""Gemma foliage LoRA for Ray on Spark (closed-set common-name ID).

Env: BASE_MODEL_ID, DATASET_PATH, OUTPUT_ADAPTER_DIR, MAX_STEPS, LORA_R, SPECIES_LIST
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model
from PIL import Image
from transformers import (
    AutoModelForImageTextToText,
    AutoProcessor,
    Trainer,
    TrainingArguments,
)


def _disable_broken_torch_native_triton() -> None:
    try:
        from torch._native.registry import deregister_op_overrides

        deregister_op_overrides(disable_dsl_names=["triton"])
    except Exception as exc:  # noqa: BLE001
        print(f"warn: could not disable torch._native triton ({exc})")


def _species_catalog(rows: list[dict]) -> list[str]:
    names = sorted({r["label"] for r in rows})
    return names


def _prompt_for(label: str, catalog: list[str]) -> str:
    choices = ", ".join(catalog)
    return (
        "Identify the plant in the photo.\n"
        f"Choose exactly one common name from this list: {choices}.\n"
        "Reply with that common name only. No punctuation, no extra words."
    )


def _load_rows(path: Path, root: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            img = root / row["image"]
            if not img.is_file():
                continue
            label = row.get("species") or row.get("scientific") or "unknown"
            rows.append({"image_path": str(img), "label": label})
    return rows


def main() -> None:
    base_model = os.environ.get(
        "BASE_MODEL_ID", "/mnt/nas/models/hf/google/gemma-3-12b-it"
    )
    dataset_root = Path(os.environ.get("DATASET_PATH", "data/foliage"))
    output = Path(os.environ.get("OUTPUT_ADAPTER_DIR", "artifacts/foliage-lora"))
    max_steps = int(os.environ.get("MAX_STEPS", "600"))
    lora_r = int(os.environ.get("LORA_R", "16"))
    output.mkdir(parents=True, exist_ok=True)

    train_path = dataset_root / "train.jsonl"
    if not train_path.exists():
        raise SystemExit(f"Missing {train_path}")

    train_rows = _load_rows(train_path, dataset_root)
    if not train_rows:
        raise SystemExit(f"No usable rows with images under {dataset_root}")

    eval_path = dataset_root / "eval.jsonl"
    eval_rows = _load_rows(eval_path, dataset_root) if eval_path.exists() else []
    catalog = _species_catalog(train_rows + eval_rows)
    for rows in (train_rows, eval_rows):
        for r in rows:
            r["prompt"] = _prompt_for(r["label"], catalog)

    print(
        f"Loading {base_model} for LoRA on {len(train_rows)} train / "
        f"{len(eval_rows)} eval | {len(catalog)} species | "
        f"r={lora_r} max_steps={max_steps} → {output}"
    )

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required on Spark worker")
    _disable_broken_torch_native_triton()

    processor = AutoProcessor.from_pretrained(base_model, trust_remote_code=True)
    model = AutoModelForImageTextToText.from_pretrained(
        base_model,
        dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    model = get_peft_model(
        model,
        LoraConfig(
            r=lora_r,
            lora_alpha=lora_r * 2,
            lora_dropout=0.05,
            bias="none",
            target_modules="all-linear",
            task_type="CAUSAL_LM",
        ),
    )
    model.print_trainable_parameters()

    pad_id = processor.tokenizer.pad_token_id

    def collate(batch: list[dict]) -> dict:
        images = [Image.open(b["image_path"]).convert("RGB") for b in batch]
        texts: list[str] = []
        prompt_lens: list[int] = []
        for b in batch:
            user_msgs = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image"},
                        {"type": "text", "text": b["prompt"]},
                    ],
                }
            ]
            prompt_only = processor.apply_chat_template(
                user_msgs,
                add_generation_prompt=True,
                tokenize=False,
            )
            full_msgs = user_msgs + [
                {
                    "role": "model",
                    "content": [{"type": "text", "text": b["label"]}],
                }
            ]
            full = processor.apply_chat_template(
                full_msgs,
                add_generation_prompt=False,
                tokenize=False,
            )
            texts.append(full)
            # token length of prompt-only (with generation cue) for label mask
            prompt_ids = processor.tokenizer(
                prompt_only, add_special_tokens=False
            )["input_ids"]
            prompt_lens.append(len(prompt_ids))

        enc = processor(
            text=texts,
            images=images,
            return_tensors="pt",
            padding=True,
        )
        labels = enc["input_ids"].clone()
        for i, plen in enumerate(prompt_lens):
            # Mask prompt tokens; also mask pad
            labels[i, :plen] = -100
            if pad_id is not None:
                labels[i, enc["input_ids"][i] == pad_id] = -100
        enc["labels"] = labels
        return enc

    train_ds = Dataset.from_list(train_rows)
    eval_ds = Dataset.from_list(eval_rows) if eval_rows else None

    # Rough: ~1 epoch coverage if max_steps unset scale — caller sets MAX_STEPS
    args = TrainingArguments(
        output_dir=str(output / "run"),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        max_steps=max_steps,
        logging_steps=20,
        save_steps=max(max_steps // 2, 50),
        bf16=True,
        remove_unused_columns=False,
        report_to=[],
        dataloader_num_workers=0,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collate,
    )
    trainer.train()
    model.save_pretrained(str(output))
    processor.save_pretrained(str(output))
    (output / "species_catalog.json").write_text(
        json.dumps({"species": catalog}, indent=2) + "\n"
    )
    print(f"Saved adapter to {output}")


if __name__ == "__main__":
    main()
