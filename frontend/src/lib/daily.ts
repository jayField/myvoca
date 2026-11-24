/** 하루 단어: the JLPT words in order (N5, then N4, then N3), ten a day, each day's test adding earlier days' words. */
import type { Item } from '../types';
import { ITEMS_BY_DECK } from './content';
import { sample, shuffle, type Rng } from './random';

export const DAILY_SIZE = 10;
/** Earlier words added to a day's test: day 2 gets all of day 1, later days ten at random from the days before. */
export const DAILY_REVIEW = 10;
export const DAILY_DONE_KEY = 'tango-note.daily.done';

const LEVELS = ['n5', 'n4', 'n3'] as const;
export const DAILY_WORDS: Item[] = LEVELS.flatMap((id) => ITEMS_BY_DECK.get(id) ?? []);
export const DAILY_DAYS = Math.ceil(DAILY_WORDS.length / DAILY_SIZE);

export function dayWords(day: number): Item[] {
  return DAILY_WORDS.slice((day - 1) * DAILY_SIZE, day * DAILY_SIZE);
}

/** All of the day's own words plus DAILY_REVIEW at random from the days before, mixed together. */
export function dayTest(day: number, rng: Rng = Math.random): { item: Item; earlier: boolean }[] {
  const earlier = sample(DAILY_WORDS.slice(0, (day - 1) * DAILY_SIZE), DAILY_REVIEW, rng);
  return shuffle(
    [...dayWords(day).map((item) => ({ item, earlier: false })), ...earlier.map((item) => ({ item, earlier: true }))],
    rng,
  );
}

/** JLPT level of a day, from its first word: N5, N4 or N3. */
export function dayLevel(day: number): string {
  return (dayWords(day)[0]?.deck_id ?? 'n5').toUpperCase();
}

const KANJI = /[㐀-鿿々]/;

/** ひらがな(漢字) when the word has kanji, otherwise the word as it is written (カタカナ words stay katakana). */
export function dailyLabel(item: Pick<Item, 'term' | 'reading'>): string {
  return KANJI.test(item.term) ? `${item.reading}(${item.term})` : item.term;
}

export function parseDay(text: string | undefined): number | null {
  const day = Number(text);
  return Number.isInteger(day) && day >= 1 && day <= DAILY_DAYS ? day : null;
}

/** Days whose test has been finished on this device, per account. */
export function loadDoneDays(userId: string | undefined): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(`${DAILY_DONE_KEY}.${userId ?? 'local'}`) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((d): d is number => typeof d === 'number') : []);
  } catch {
    return new Set();
  }
}

export function markDayDone(userId: string | undefined, day: number): void {
  try {
    const done = loadDoneDays(userId);
    done.add(day);
    localStorage.setItem(`${DAILY_DONE_KEY}.${userId ?? 'local'}`, JSON.stringify([...done].sort((a, b) => a - b)));
  } catch {
    // Ticks on the day list are a nicety; ignore storage failures.
  }
}
