import { questForDate, type ColorQuest } from '@/domain/quest';

export function todaysQuest(now: Date = new Date()): ColorQuest {
  return questForDate(now);
}
