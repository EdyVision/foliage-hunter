import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FindRecord } from '@/domain/find';
import type { FindHistory } from '@/ports/FindHistory';

const KEY = 'foliage-hunter.finds.v1';
const MAX = 24;

async function readAll(): Promise<FindRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FindRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records: FindRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX)));
}

export function createAsyncFindHistory(): FindHistory {
  return {
    async list(): Promise<FindRecord[]> {
      return readAll();
    },

    async add(input): Promise<FindRecord> {
      const record: FindRecord = {
        id: input.id ?? `find-${Date.now()}`,
        photoUri: input.photoUri,
        leafGuess: input.leafGuess,
        reply: input.reply,
        colors: input.colors ?? [],
        createdAt: input.createdAt ?? new Date().toISOString(),
        audioUris: input.audioUris,
        location: input.location,
      };
      const existing = await readAll();
      const next = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, MAX);
      await writeAll(next);
      return record;
    },

    async update(id, patch): Promise<FindRecord | null> {
      const existing = await readAll();
      const index = existing.findIndex((r) => r.id === id);
      if (index < 0) return null;
      const next: FindRecord = { ...existing[index]!, ...patch, id };
      existing[index] = next;
      await writeAll(existing);
      return next;
    },

    async remove(id: string): Promise<void> {
      const existing = await readAll();
      await writeAll(existing.filter((r) => r.id !== id));
    },

    async clear(): Promise<void> {
      await AsyncStorage.removeItem(KEY);
    },
  };
}
