import type { GuideTurn, LeafPhoto, VoiceRecording } from '@/domain/guide';
import type { GuideClient } from '@/ports/GuideClient';

export interface HttpGuideClientOptions {
  baseUrl: string;
  apiKey?: string;
  model?: string;
}

function normalizeOrigin(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '').replace(/\/v1$/i, '');
}

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`fetch failed: ${detail}`);
  }
}

/** Short, speakable error for the UI; the raw gateway body goes to the console. */
async function failureMessage(response: Response, what: string): Promise<string> {
  const body = (await response.text().catch(() => '')) || '';
  if (body) console.warn(`[foliage] ${what} ${response.status}:`, body.slice(0, 600));
  if (response.status >= 500) {
    return `${what} is having trouble with that photo (${response.status}). Try another shot.`;
  }
  if (response.status === 401 || response.status === 403) {
    return `${what} rejected the API key (${response.status}). Check EXPO_PUBLIC_GUIDE_API_KEY.`;
  }
  return `${what} failed (${response.status}).`;
}

async function parseTurn(response: Response): Promise<GuideTurn> {
  if (!response.ok) {
    throw new Error(await failureMessage(response, 'The guide'));
  }
  return response.json() as Promise<GuideTurn>;
}

/** Pull a short common name out of a chat reply if the model adds prose. */
function extractLeafName(raw: string): string {
  let text = raw.trim();
  if (!text) return '';
  text = text.replace(/^["'`]+|["'`]+$/g, '');
  const looksLike = text.match(
    /(?:looks like|this is|that is|named?)\s+(?:an?\s+)?(.+?)(?:[.!]|$)/i,
  );
  if (looksLike?.[1]) text = looksLike[1].trim();
  text = text.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  const line = text.split(/\n/)[0]?.trim() ?? text;
  // Keep short labels; truncate runaway generations.
  return line.length > 64 ? line.slice(0, 64).trim() : line;
}

/**
 * OpenAI-compat identify. Omit client text so the foliage guide-server can apply
 * its species-catalog prompt (same path that hit held-out eval).
 */
async function identifyViaChat(
  origin: string,
  photo: LeafPhoto,
  model: string,
  apiKey: string | undefined,
): Promise<GuideTurn> {
  const FileSystem = await import('expo-file-system/legacy');
  const b64 = await FileSystem.readAsStringAsync(photo.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = photo.mediaType || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${b64}`;

  const chat = await safeFetch(`${origin}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      ...headers(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: dataUrl } }],
        },
      ],
    }),
  });

  if (!chat.ok) {
    throw new Error(await failureMessage(chat, 'The guide'));
  }
  const payload = (await chat.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const leaf = extractLeafName(payload.choices?.[0]?.message?.content ?? '');
  return {
    transcript: '(photo identify)',
    reply: leaf
      ? `That looks like ${leaf}. Nice find.`
      : 'I could not name that one. Try a closer leaf shot in better light.',
    leafGuess: leaf || undefined,
  };
}

export function createHttpGuideClient(options: HttpGuideClientOptions): GuideClient {
  const origin = normalizeOrigin(options.baseUrl);
  const model = options.model ?? 'gemma-foliage';

  return {
    async identifyPhoto(photo: LeafPhoto, prompt?: string): Promise<GuideTurn> {
      // Prefer guide-server /vision/turn. Leave prompt empty unless the caller
      // overrides — empty lets the server use its catalog-constrained prompt.
      const form = new FormData();
      form.append('image', {
        uri: photo.uri,
        name: photo.name,
        type: photo.mediaType,
      } as unknown as Blob);
      if (prompt?.trim()) form.append('prompt', prompt.trim());

      try {
        const vision = await safeFetch(`${origin}/v1/vision/turn`, {
          method: 'POST',
          headers: headers(options.apiKey),
          body: form,
        });
        if (vision.ok) {
          const turn = await parseTurn(vision);
          const leaf = extractLeafName(turn.leafGuess ?? turn.reply ?? '');
          return {
            ...turn,
            leafGuess: leaf || turn.leafGuess,
            reply: turn.reply?.trim()
              ? turn.reply
              : leaf
                ? `That looks like ${leaf}. Nice find.`
                : turn.reply,
          };
        }
        if (vision.status !== 404 && vision.status !== 405) {
          throw new Error(await failureMessage(vision, 'The guide'));
        }
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        if (!/fetch failed|404|405|not found/i.test(msg)) {
          throw cause instanceof Error ? cause : new Error(msg);
        }
      }

      return identifyViaChat(origin, photo, model, options.apiKey);
    },

    async voiceTurn(recording: VoiceRecording): Promise<GuideTurn> {
      const form = new FormData();
      form.append('file', {
        uri: recording.uri,
        name: recording.name,
        type: recording.mediaType,
      } as unknown as Blob);

      const response = await safeFetch(`${origin}/v1/voice/turn`, {
        method: 'POST',
        headers: headers(options.apiKey),
        body: form,
      });
      return parseTurn(response);
    },
  };
}
