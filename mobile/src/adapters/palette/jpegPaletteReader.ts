import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

import type { LeafPhoto, PhotoColor } from '@/domain/guide';
import type { PaletteReader } from '@/ports/PaletteReader';

/** Fall leaf names — warm / high-chroma foliage, not lawn greens. */
const NAMED: { name: string; r: number; g: number; b: number }[] = [
  { name: 'scarlet', r: 155, g: 34, b: 38 },
  { name: 'rust', r: 194, g: 65, b: 12 },
  { name: 'ember', r: 232, g: 93, b: 4 },
  { name: 'amber', r: 244, g: 162, b: 97 },
  { name: 'gold', r: 255, g: 186, b: 8 },
  { name: 'forest', r: 45, g: 106, b: 79 },
  { name: 'olive', r: 96, g: 108, b: 56 },
  { name: 'bronze', r: 139, g: 94, b: 52 },
  { name: 'burgundy', r: 106, g: 4, b: 15 },
  { name: 'plum', r: 92, g: 75, b: 108 },
];

function hex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function nearestName(r: number, g: number, b: number): string {
  let best = NAMED[0]!;
  let bestD = Infinity;
  for (const c of NAMED) {
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

function chroma(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/** True for dull grass / background greens that are not leaf pigment. */
function isBackgroundGreen(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const greenLead = g - Math.max(r, b);
  return greenLead > 12 && sat < 0.42 && max < 200;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i]!);
    const b = alphabet.indexOf(clean[i + 1]!);
    const c = alphabet.indexOf(clean[i + 2]!);
    const d = alphabet.indexOf(clean[i + 3]!);
    const triple = (a << 18) | (b << 12) | ((c > 0 ? c : 0) << 6) | (d > 0 ? d : 0);
    out[o++] = (triple >> 16) & 255;
    if (clean[i + 2] !== '=' && c >= 0) out[o++] = (triple >> 8) & 255;
    if (clean[i + 3] !== '=' && d >= 0) out[o++] = triple & 255;
  }
  return out.subarray(0, o);
}

export function createJpegPaletteReader(): PaletteReader {
  return {
    async colorsFromPhoto(photo: LeafPhoto, limit = 4): Promise<PhotoColor[]> {
      // Resize first, then crop the center — the leaf is usually framed there,
      // while edges are path, grass, sky, or hands.
      const staged = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 96 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const cropSize = Math.floor(Math.min(staged.width, staged.height) * 0.62);
      const small = await ImageManipulator.manipulateAsync(
        staged.uri,
        [
          {
            crop: {
              originX: Math.floor((staged.width - cropSize) / 2),
              originY: Math.floor((staged.height - cropSize) / 2),
              width: cropSize,
              height: cropSize,
            },
          },
          { resize: { width: 48 } },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );

      let b64 = small.base64;
      if (!b64) {
        b64 = await FileSystem.readAsStringAsync(small.uri, {
          encoding: 'base64',
        });
      }

      const decoded = jpeg.decode(base64ToUint8Array(b64), { useTArray: true, formatAsRGBA: true });
      const data = decoded.data;
      const width = decoded.width;
      const height = decoded.height;
      const cx = (width - 1) / 2;
      const cy = (height - 1) / 2;
      const buckets = new Map<string, { r: number; g: number; b: number; n: number; w: number }>();

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const a = data[i + 3] ?? 255;
          if (a < 200) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max < 28 || min > 235) continue;
          if (chroma(r, g, b) < 28) continue;
          if (isBackgroundGreen(r, g, b)) continue;

          // Soft radial weight: center of the crop counts more than the rim.
          const nx = (x - cx) / Math.max(cx, 1);
          const ny = (y - cy) / Math.max(cy, 1);
          const radial = Math.min(1, Math.hypot(nx, ny));
          const weight = 1.35 - radial;

          const key = `${r >> 4},${g >> 4},${b >> 4}`;
          const cur = buckets.get(key);
          if (cur) {
            cur.r += r * weight;
            cur.g += g * weight;
            cur.b += b * weight;
            cur.n += 1;
            cur.w += weight;
          } else {
            buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, n: 1, w: weight });
          }
        }
      }

      const ranked = [...buckets.values()].sort((a, b) => b.w - a.w);
      const total = ranked.reduce((s, c) => s + c.w, 0) || 1;
      const usedNames = new Set<string>();
      const out: PhotoColor[] = [];

      for (const c of ranked) {
        if (out.length >= limit) break;
        const r = c.r / c.w;
        const g = c.g / c.w;
        const b = c.b / c.w;
        const name = nearestName(r, g, b);
        if (usedNames.has(name)) continue;
        usedNames.add(name);
        out.push({ hex: hex(r, g, b), name, share: c.w / total });
      }

      return out;
    },
  };
}
