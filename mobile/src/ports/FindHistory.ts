import type { FindRecord } from '@/domain/find';

/** Device-local trail history (newest first, capped by the adapter). */
export interface FindHistory {
  list(): Promise<FindRecord[]>;
  add(record: Omit<FindRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<FindRecord>;
  /** Patch an existing record in place; no-op when the id is gone. */
  update(id: string, patch: Partial<Omit<FindRecord, 'id'>>): Promise<FindRecord | null>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
