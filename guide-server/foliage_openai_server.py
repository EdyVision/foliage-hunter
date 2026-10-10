"""Minimal OpenAI-compatible vision chat server for the foliage LoRA.

Uses the same transformers+PEFT path that hit 85.1% held-out.
Env:
  BASE_MODEL_ID   default /mnt/nas/models/hf/google/gemma-3-12b-it
  ADAPTER_DIR     default ~/foliage-hunter-artifacts/foliage-lora
  HOST / PORT     default 0.0.0.0:8003
  SERVED_MODEL    default gemma-foliage
"""

from __future__ import annotations

import base64
import io
import json
import os
import time
from pathlib import Path
from typing import Any

import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from peft import PeftModel
from PIL import Image
from pydantic import BaseModel, Field
from transformers import AutoModelForImageTextToText, AutoProcessor


def _disable_broken_torch_native_triton() -> None:
    try:
        from torch._native.registry import deregister_op_overrides

        deregister_op_overrides(disable_dsl_names=["triton"])
    except Exception as exc:  # noqa: BLE001
        print(f"warn: torch._native triton disable failed ({exc})")


BASE = os.environ.get("BASE_MODEL_ID", "/mnt/nas/models/hf/google/gemma-3-12b-it")
ADAPTER = Path(
    os.environ.get(
        "ADAPTER_DIR",
        str(Path.home() / "foliage-hunter-artifacts" / "foliage-lora"),
    )
).expanduser()
SERVED = os.environ.get("SERVED_MODEL", "gemma-foliage")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8003"))

app = FastAPI(title="foliage-hunter-guide-server")
_processor = None
_model = None
_catalog: list[str] = []


def _load() -> None:
    global _processor, _model, _catalog
    if _model is not None:
        return
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA required")
    _disable_broken_torch_native_triton()
    cat_path = ADAPTER / "species_catalog.json"
    if cat_path.is_file():
        _catalog = json.loads(cat_path.read_text()).get("species") or []
    print(f"Loading base={BASE} adapter={ADAPTER} served={SERVED}")
    _processor = AutoProcessor.from_pretrained(BASE, trust_remote_code=True)
    model = AutoModelForImageTextToText.from_pretrained(
        BASE,
        dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    _model = PeftModel.from_pretrained(model, str(ADAPTER))
    _model.eval()
    print("Ready")


def _image_from_part(part: dict[str, Any]) -> Image.Image | None:
    url = (part.get("image_url") or {}).get("url") or part.get("url")
    if not url:
        return None
    if url.startswith("data:"):
        _, b64 = url.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    path = url.removeprefix("file://")
    return Image.open(path).convert("RGB")


class ChatRequest(BaseModel):
    model: str = SERVED
    messages: list[dict[str, Any]]
    max_tokens: int = Field(default=64, alias="max_tokens")
    temperature: float = 0.0


def _default_identify_prompt() -> str:
    if _catalog:
        choices = ", ".join(_catalog)
        return (
            "Identify the plant in the photo.\n"
            f"Choose exactly one common name from this list: {choices}.\n"
            "Reply with that common name only. No punctuation, no extra words."
        )
    return (
        "Identify this outdoor plant from the photo. "
        "Answer with the common name only."
    )


def _generate(
    images: list[Image.Image],
    user_text: str,
    max_tokens: int,
    temperature: float,
) -> str:
    assert _processor is not None and _model is not None
    content: list[dict[str, Any]] = [{"type": "image"} for _ in images]
    content.append({"type": "text", "text": user_text})
    messages = [{"role": "user", "content": content}]
    prompt = _processor.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=False
    )
    enc = _processor(text=[prompt], images=images, return_tensors="pt").to(
        _model.device
    )
    with torch.inference_mode():
        out = _model.generate(
            **enc,
            max_new_tokens=int(max_tokens),
            do_sample=temperature > 0,
            temperature=max(temperature, 1e-5) if temperature > 0 else None,
        )
    gen = out[0][enc["input_ids"].shape[-1] :]
    return _processor.decode(gen, skip_special_tokens=True).strip()


def _guide_reply(leaf_name: str) -> str:
    name = leaf_name.strip() or "something outdoors"
    return f"That looks like {name}. Nice find."


@app.on_event("startup")
def startup() -> None:
    _load()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
def models() -> dict[str, Any]:
    return {
        "object": "list",
        "data": [{"id": SERVED, "object": "model", "owned_by": "foliage-hunter"}],
    }


@app.post("/v1/chat/completions")
def chat(req: ChatRequest) -> dict[str, Any]:
    _load()
    assert _processor is not None and _model is not None

    images: list[Image.Image] = []
    text_bits: list[str] = []
    for msg in req.messages:
        content = msg.get("content")
        if isinstance(content, str):
            text_bits.append(content)
            continue
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                ptype = part.get("type")
                if ptype in ("image_url", "image"):
                    img = _image_from_part(part)
                    if img is not None:
                        images.append(img)
                elif ptype == "text":
                    text_bits.append(str(part.get("text") or ""))

    user_text = "\n".join(t for t in text_bits if t).strip() or _default_identify_prompt()

    if not images:
        raise HTTPException(400, "vision turn requires an image_url part")

    text = _generate(images, user_text, req.max_tokens, req.temperature)
    now = int(time.time())
    return {
        "id": f"chatcmpl-foliage-{now}",
        "object": "chat.completion",
        "created": now,
        "model": SERVED,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
    }


@app.post("/v1/vision/turn")
async def vision_turn(
    image: UploadFile = File(...),
    prompt: str = Form(default=""),
) -> dict[str, Any]:
    """Guide-contract vision turn for the Expo client (multipart image)."""
    _load()
    raw = await image.read()
    if not raw:
        raise HTTPException(400, "empty image")
    try:
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"unreadable image: {exc}") from exc

    user_text = (prompt or "").strip() or _default_identify_prompt()
    leaf = _generate([pil], user_text, max_tokens=64, temperature=0.0)
    return {
        "transcript": user_text if prompt.strip() else "(photo identify)",
        "reply": _guide_reply(leaf),
        "leafGuess": leaf,
    }


def main() -> None:
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
