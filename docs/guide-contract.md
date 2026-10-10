# Guide API contract

Public docs describe *behavior*, not where inference runs.

Clients talk to a single base URL from `EXPO_PUBLIC_GUIDE_URL`.
Deployments may sit behind any OpenAI-compatible proxy. Lab hostnames
stay in private `.env` only.

## Voice turn

`POST /v1/voice/turn`  
`multipart/form-data` field `file` (audio/wav or audio/mp4)

Response JSON:

```json
{
  "transcript": "what leaf is this",
  "reply": "That looks like a sugar maple leaf…",
  "leafGuess": "sugar maple",
  "audioBase64": optional,
  "mediaType": "audio/wav"
}
```

Typical server pipeline (implementation detail, not client-facing):

1. ASR model (`EXPO_PUBLIC_ASR_MODEL`)
2. Vision + reasoning model (`EXPO_PUBLIC_GUIDE_MODEL`) when an image is attached
3. TTS model (`EXPO_PUBLIC_TTS_MODEL`)

## Vision / identify

Preferred (OpenAI-compat gateways, same as Miilo → LiteLLM):

`POST /v1/chat/completions` with an image content part + short identify prompt.
Model id from `EXPO_PUBLIC_GUIDE_MODEL`.

Optional dedicated helper (PEFT guide-server only):

`POST /v1/vision/turn`  
`multipart/form-data`: `image` (jpeg/png), optional `prompt`

Same JSON shape as voice turn (`transcript` may echo the prompt).
The mobile client tries chat completions first, then `/v1/vision/turn`.

## Models (logical names)

| Role | Env | Example logical id |
| --- | --- | --- |
| Guide / VLM | `EXPO_PUBLIC_GUIDE_MODEL` | `gemma-foliage` |
| ASR | `EXPO_PUBLIC_ASR_MODEL` | streaming ASR alias |
| TTS | `EXPO_PUBLIC_TTS_MODEL` | local TTS alias |

Logical id `gemma-foliage` maps to the public LoRA at `EdyVision/foliage-hunter-gemma3-12b` (`adapters/colorado_v1`) on base `google/gemma-3-12b-it`. Experiments: `EdyVision/foliage-hunter-experiments`.
