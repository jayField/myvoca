// 회화 노트: expressions picked up in conversation, translated by /api/translate and saved per account.
// Unlike the bundled decks these live only in Supabase, so they need a signed-in account.
import type { Item, Phrase, PhraseWord, Translation } from '../types';
import { toHangul } from './kana';
import { supabase } from './supabase';

export const TALK_DECK = { id: 'talk', title: '회화 노트', description: '대화하면서 배운 표현을 번역해서 모아요' };

const SIGN_IN = '회화 노트는 로그인해야 쓸 수 있어요.';
const NETWORK = '인터넷 연결을 확인하고 다시 시도해 주세요.';


/** Folds a search text so width, case, spaces and katakana/hiragana don't matter. */
function searchable(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * Whether a saved phrase matches a search: its Japanese, reading, pronunciation, meaning or what was typed.
 * Commas split the search into several words, and a phrase matching any one of them is shown.
 */
export function matchesSearch(p: Phrase, query: string): boolean {
  const words = query.split(/[,，、]/).map(searchable).filter(Boolean);
  if (!words.length) return true;
  const fields = [p.japanese, p.reading, phraseSound(p), p.meaning, p.input].map((field) => searchable(field ?? ''));
  return words.some((word) => fields.some((field) => field.includes(word)));
}

/**
 * How a phrase sounds in Hangul, spaced the way Korean is (君を思っている → 키미오 오못테이루) when its word
 * breakdown is known; otherwise the whole reading run together.
 */
export function phraseSound(p: Pick<Translation, 'reading' | 'words'> & { sound?: string }): string {
  if (p.sound) return p.sound;
  return autoSound(p);
}

/** The pronunciation worked out from the reading, ignoring any the learner typed. */
export function autoSound(p: Pick<Translation, 'reading' | 'words'>): string {
  if (p.words.length < 2) return toHangul(p.reading);
  return p.words.map((w, i) => (i > 0 && !w.attach ? ' ' : '') + wordSound(w)).join('');
}

/** The particles は and へ are written with those kana but said わ and え. */
const PARTICLE_SOUNDS: Record<string, string> = { は: '와', へ: '에' };

function wordSound(w: PhraseWord): string {
  return (w.attach && PARTICLE_SOUNDS[w.reading]) || toHangul(w.reading);
}

/** A phrase as a quiz item, so the existing quiz screens can ask it like a word. */
export function phraseItem(p: Phrase): Item {
  return {
    id: `${TALK_DECK.id}:${p.id}`,
    deck_id: TALK_DECK.id,
    kind: 'word',
    term: p.japanese,
    display: p.japanese,
    reading: p.reading,
    meaning: p.meaning,
    example_ja: null,
    example_ko: null,
  };
}

function client() {
  if (!supabase) throw new Error(SIGN_IN);
  return supabase;
}

/** Only what the app shows; older rows also hold examples and notes that are no longer used. */
const COLUMNS = 'id,input,japanese,reading,meaning,sound,position,words,created_at';
const WITHOUT_POSITION = 'id,input,japanese,reading,meaning,sound,words,created_at';
/** A query's outcome, loosely typed so the with- and without-position queries can share a variable. */
type Result = { data: unknown; error: { code: string } | null };
/** Postgres / PostgREST codes for a column that does not exist yet (the order column before its SQL is run). */
const MISSING_COLUMN = new Set(['42703', 'PGRST204']);
const NEEDS_SQL = '순서를 저장하려면 Supabase에서 순서 칸을 추가하는 SQL을 먼저 실행해 주세요.';

const withPosition = (row: Omit<Phrase, 'position'> & { position?: number | null }): Phrase => ({ ...row, position: row.position ?? null });

/** In the learner's order: by position, then (for rows never moved) newest first. */
export async function listPhrases(): Promise<Phrase[]> {
  const phrases = client().from('phrases');
  let res: Result = await phrases
    .select(COLUMNS)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (res.error && MISSING_COLUMN.has(res.error.code)) {
    res = await phrases.select(WITHOUT_POSITION).order('created_at', { ascending: false });
  }
  if (res.error) throw new Error(NETWORK);
  return (res.data as Omit<Phrase, 'position'>[]).map(withPosition);
}

/** New phrases go on top: below every position given so far (moves use small numbers, this a large negative). */
const topPosition = () => -Date.now() / 1000;

export async function savePhrase(input: string, t: Translation): Promise<Phrase> {
  const phrases = client().from('phrases');
  let res: Result = await phrases.insert({ input, ...t, position: topPosition() }).select(COLUMNS).single();
  if (res.error && MISSING_COLUMN.has(res.error.code)) {
    res = await phrases.insert({ input, ...t }).select(WITHOUT_POSITION).single();
  }
  if (res.error) throw new Error(`저장하지 못했어요. ${NETWORK}`);
  return withPosition(res.data as Omit<Phrase, 'position'>);
}

/**
 * The positions to store after the phrase at `index` was moved there: usually one, halfway between its new
 * neighbours. When a neighbour has none yet, or the numbers have run too close, the whole list is renumbered.
 */
export function placeAt(list: Phrase[], index: number): { id: string; position: number }[] {
  const prev = index > 0 ? list[index - 1].position : undefined;
  const next = index < list.length - 1 ? list[index + 1].position : undefined;
  if (prev !== null && next !== null) {
    const position =
      prev === undefined && next === undefined ? 0 : prev === undefined ? next! - 1 : next === undefined ? prev + 1 : (prev + next) / 2;
    if (position !== prev && position !== next) return [{ id: list[index].id, position }];
  }
  return list.map((p, i) => ({ id: p.id, position: i })).filter((u, i) => list[i].position !== u.position);
}

export async function savePositions(updates: { id: string; position: number }[]): Promise<void> {
  const results = await Promise.all(updates.map((u) => client().from('phrases').update({ position: u.position }).eq('id', u.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(MISSING_COLUMN.has(failed.error.code) ? NEEDS_SQL : `순서를 저장하지 못했어요. ${NETWORK}`);
}

export type PhraseEdit = Pick<Phrase, 'japanese' | 'reading' | 'sound' | 'meaning' | 'words'>;

/** Save edits to a phrase; returns the stored row. */
export async function updatePhrase(id: string, edit: PhraseEdit): Promise<Phrase> {
  const phrases = client().from('phrases');
  let res: Result = await phrases.update(edit).eq('id', id).select(COLUMNS).single();
  if (res.error && MISSING_COLUMN.has(res.error.code)) res = await phrases.update(edit).eq('id', id).select(WITHOUT_POSITION).single();
  if (res.error) throw new Error(`고치지 못했어요. ${NETWORK}`);
  return withPosition(res.data as Omit<Phrase, 'position'>);
}

export async function deletePhrase(id: string): Promise<void> {
  const { error } = await client().from('phrases').delete().eq('id', id);
  if (error) throw new Error(`지우지 못했어요. ${NETWORK}`);
}

/** Ask the server to translate; the Gemini key lives there. */
export async function translatePhrase(input: string): Promise<Translation> {
  const { data } = await client().auth.getSession();
  if (!data.session) throw new Error(SIGN_IN);
  let res: Response;
  try {
    res = await fetch('/api/translate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
  } catch {
    throw new Error(`번역하지 못했어요. ${NETWORK}`);
  }
  const body = (await res.json().catch(() => null)) as { result?: Translation; error?: string } | null;
  if (!res.ok || !body?.result) throw new Error(body?.error ?? '번역하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  return body.result;
}
