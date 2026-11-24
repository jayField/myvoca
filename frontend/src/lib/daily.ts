/** 하루 단어: the JLPT words in order (N5, then N4, then N3), ten a day, each day's test adding earlier days' words.
 * A day is passed with a perfect test; which days are passed is each account's own. */
import type { Item } from '../types';
import { ITEMS_BY_DECK } from './content';
import { sample, shuffle, type Rng } from './random';
import { supabase } from './supabase';

export const DAILY_SIZE = 10;
/** Earlier words added to a day's test: day 2 gets all of day 1, later days ten at random from the days before. */
export const DAILY_REVIEW = 10;
export const DAILY_PASSED_KEY = 'tango-note.daily.passed';

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

/** Supabase errors for a table the schema has not created yet. */
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

function localKey(userId: string | undefined): string {
  return `${DAILY_PASSED_KEY}.${userId ?? 'local'}`;
}

/** Days passed as remembered on this device, per account: shown at once and kept if the account is unreachable. */
export function localPassedDays(userId: string | undefined): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(userId)) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((d): d is number => Number.isInteger(d)) : []);
  } catch {
    return new Set();
  }
}

function saveLocal(userId: string | undefined, days: Set<number>): void {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify([...days].sort((a, b) => a - b)));
  } catch {
    // The account copy is the one that counts; ignore storage failures.
  }
}

/**
 * The account's passed days, merged with this device's: a day passed while offline (or before the table
 * existed) is sent up, so every device of the account colors in the same days and nobody else's.
 */
export async function loadPassedDays(userId: string | undefined): Promise<Set<number>> {
  const local = localPassedDays(userId);
  if (!supabase || !userId) return local;
  const { data, error } = await supabase.from('daily_passed').select('day');
  if (error) return local;
  const remote = new Set((data as { day: number }[]).map((r) => r.day));
  const missing = [...local].filter((d) => !remote.has(d));
  if (missing.length) await supabase.from('daily_passed').upsert(missing.map((day) => ({ day })), { onConflict: 'user_id,day' });
  const all = new Set([...remote, ...local]);
  saveLocal(userId, all);
  return all;
}

/** A perfect test: remember the day here and on the account. */
export async function markDayPassed(userId: string | undefined, day: number): Promise<void> {
  const local = localPassedDays(userId);
  local.add(day);
  saveLocal(userId, local);
  if (!supabase || !userId) return;
  const { error } = await supabase.from('daily_passed').upsert({ day }, { onConflict: 'user_id,day' });
  // Kept on this device either way; the next load sends it up once the account is reachable.
  if (error && !MISSING_TABLE.has(error.code)) console.warn('daily_passed', error.message);
}

/** Forget every passed day on the account (전체 초기화). */
export async function deleteRemotePassedDays(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('daily_passed').delete().gte('day', 0);
  if (error && !MISSING_TABLE.has(error.code)) throw error;
}

/** Score out of 100: the share of cards answered 알았음. */
export function testScore(good: number, total: number): number {
  return total ? Math.round((good / total) * 100) : 0;
}
