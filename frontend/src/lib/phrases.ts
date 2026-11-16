// 회화 노트: expressions picked up in conversation, translated by /api/translate and saved per account.
// Unlike the bundled decks these live only in Supabase, so they need a signed-in account.
import type { Item, Phrase, Translation } from '../types';
import { localDate } from './dates';
import { toHangul } from './kana';
import { supabase } from './supabase';

export const TALK_DECK = { id: 'talk', title: '회화 노트', description: '대화하면서 배운 표현을 번역해서 모아요' };

const SIGN_IN = '회화 노트는 로그인해야 쓸 수 있어요.';
const NETWORK = '인터넷 연결을 확인하고 다시 시도해 주세요.';


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
  return p.words.map((w, i) => (i > 0 && !w.attach ? ' ' : '') + toHangul(w.reading)).join('');
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
const COLUMNS = 'id,input,japanese,reading,meaning,sound,words,created_at';

export async function listPhrases(): Promise<Phrase[]> {
  const { data, error } = await client().from('phrases').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(NETWORK);
  return data as Phrase[];
}

export async function savePhrase(input: string, t: Translation): Promise<Phrase> {
  const { data, error } = await client().from('phrases').insert({ input, ...t }).select(COLUMNS).single();
  if (error) throw new Error(`저장하지 못했어요. ${NETWORK}`);
  return data as Phrase;
}

export type PhraseEdit = Pick<Phrase, 'japanese' | 'reading' | 'sound' | 'meaning' | 'words'>;

/** Save edits to a phrase; returns the stored row. */
export async function updatePhrase(id: string, edit: PhraseEdit): Promise<Phrase> {
  const { data, error } = await client().from('phrases').update(edit).eq('id', id).select(COLUMNS).single();
  if (error) throw new Error(`고치지 못했어요. ${NETWORK}`);
  return data as Phrase;
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

/** Saved phrases by the day they were saved, newest day first (the list already arrives newest first). */
export function groupByDay(phrases: Phrase[]): [string, Phrase[]][] {
  const groups = new Map<string, Phrase[]>();
  for (const p of phrases) {
    const day = localDate(new Date(p.created_at));
    groups.set(day, [...(groups.get(day) ?? []), p]);
  }
  return [...groups.entries()];
}
