// 노래: songs with lyrics timed to a YouTube video, registered ahead of time and shared by every account.
// Timed lyrics come from LRCLIB (a free, open lyrics database), each line is explained once by
// /api/lyrics, and the result is stored in Supabase, never in this (public) code.
import type { PhraseWord } from '../types';
import { phraseSound, searchable } from './phrases';
import { supabase } from './supabase';

export interface SongLine {
  /** When the line starts in the original recording, in seconds. */
  t: number;
  japanese: string;
  reading: string;
  meaning: string;
  words: PhraseWord[];
  /** A Hangul pronunciation typed in by hand, used instead of the automatic one. */
  sound?: string;
}

/** A line's Hangul pronunciation: the hand-typed one, else the one made from its reading. */
export const lineSound = (line: SongLine) => line.sound || phraseSound(line);

export interface Song {
  id: string;
  title_ko: string;
  title_ja: string;
  artist: string;
  youtube_id: string;
  /** Added to every line's time to match the video, in milliseconds. */
  offset_ms: number;
  lines: SongLine[];
  created_at: string;
}

/** One timed-lyrics result from LRCLIB. */
export interface LyricsMatch {
  id: number;
  track: string;
  artist: string;
  /** Length of the recording the lyrics were timed to, in seconds. */
  duration: number;
  lrc: string;
}

const SIGN_IN = '노래는 로그인해야 쓸 수 있어요.';
const NETWORK = '인터넷 연결을 확인하고 다시 시도해 주세요.';
const NEEDS_SQL = '노래 기능을 쓰려면 Supabase에서 노래 표를 만드는 SQL을 먼저 실행해 주세요.';
/** Postgres / PostgREST codes for a table that does not exist yet (before its SQL is run). */
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const COLUMNS = 'id,title_ko,title_ja,artist,youtube_id,offset_ms,lines,created_at';

function client() {
  if (!supabase) throw new Error(SIGN_IN);
  return supabase;
}

const failed = (error: { code: string }, doing: string) => new Error(MISSING_TABLE.has(error.code) ? NEEDS_SQL : `${doing} ${NETWORK}`);

/** The video ID in a YouTube link (watch, youtu.be, shorts, embed, music) or a bare ID; null if there is none. */
export function youtubeId(link: string): string | null {
  const text = link.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/**
 * The timed lines of LRC lyrics ("[00:08.25] 心の中"), in time order. A line with several stamps is
 * repeated at each; an empty timed line is kept as a break (an instrumental part with nothing to sing).
 */
export function parseLrc(lrc: string): { t: number; text: string }[] {
  const lines: { t: number; text: string }[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{1,2}(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.slice(stamps.at(-1)!.index! + stamps.at(-1)![0].length).trim();
    for (const [, min, sec] of stamps) lines.push({ t: Math.round((Number(min) * 60 + Number(sec.replace(':', '.'))) * 1000) / 1000, text });
  }
  return lines.sort((a, b) => a.t - b.t);
}

/** Index of the line being sung at `time` seconds (lines shifted by `offset` seconds), or -1 before the first. */
export function lineAt(lines: { t: number }[], time: number, offset = 0): number {
  let at = -1;
  for (let i = 0; i < lines.length && lines[i].t + offset <= time; i++) at = i;
  return at;
}

/** Timed lyrics on LRCLIB for a song title (and optionally its singer), closest matches first. */
export async function searchLyrics(title: string, artist = ''): Promise<LyricsMatch[]> {
  const params = new URLSearchParams({ track_name: title.trim() });
  if (artist.trim()) params.set('artist_name', artist.trim());
  let res: Response;
  try {
    res = await fetch(`https://lrclib.net/api/search?${params}`);
  } catch {
    throw new Error(`가사를 찾지 못했어요. ${NETWORK}`);
  }
  if (!res.ok) throw new Error('가사를 찾지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  const found = (await res.json()) as { id: number; trackName: string; artistName: string; duration: number; syncedLyrics: string | null }[];
  const seen = new Set<string>();
  const matches = found
    .filter((x) => x.syncedLyrics && !seen.has(x.syncedLyrics) && seen.add(x.syncedLyrics))
    .map((x) => ({ id: x.id, track: x.trackName, artist: x.artistName, duration: x.duration, lrc: x.syncedLyrics! }));
  return rankMatches(matches, title);
}

/**
 * The song itself before karaoke or other versions (exact title first), and among those the lyrics cut
 * into the most lines first: short lines are easier to follow while singing.
 */
export function rankMatches(matches: LyricsMatch[], title: string): LyricsMatch[] {
  const exact = (m: LyricsMatch) => (m.track.trim() === title.trim() ? 0 : 1);
  const lines = (m: LyricsMatch) => parseLrc(m.lrc).filter((l) => l.text).length;
  return [...matches].sort((a, b) => exact(a) - exact(b) || lines(b) - lines(a));
}

async function explainLines(lines: string[]): Promise<{ reading: string; meaning: string; words: PhraseWord[] }[]> {
  const { data } = await client().auth.getSession();
  if (!data.session) throw new Error(SIGN_IN);
  let res: Response;
  try {
    res = await fetch('/api/lyrics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    });
  } catch {
    throw new Error(`가사를 해석하지 못했어요. ${NETWORK}`);
  }
  const body = (await res.json().catch(() => null)) as { lines?: { reading: string; meaning: string; words: PhraseWord[] }[]; error?: string } | null;
  if (!res.ok || !body?.lines) throw new Error(body?.error ?? '가사를 해석하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  return body.lines;
}

export type NewSong = Pick<Song, 'title_ko' | 'title_ja' | 'artist' | 'youtube_id'>;

/** Explains the lyrics (each distinct line once, so a repeated chorus costs nothing extra) and saves the song. */
export async function saveSong(song: NewSong, lrc: string): Promise<Song> {
  const timed = parseLrc(lrc);
  const distinct = [...new Set(timed.map((l) => l.text).filter(Boolean))];
  if (!distinct.length) throw new Error('이 가사에는 시간이 붙은 줄이 없어요. 다른 가사를 골라 주세요.');
  const explained = await explainLines(distinct);
  const byText = new Map(distinct.map((text, i) => [text, explained[i]]));
  const lines: SongLine[] = timed.map(({ t, text }) => {
    const e = byText.get(text);
    return { t, japanese: text, reading: e?.reading || text, meaning: e?.meaning ?? '', words: e?.words ?? [] };
  });
  const { data, error } = await client().from('songs').insert({ ...song, lines }).select(COLUMNS).single();
  if (error) throw failed(error, '노래를 저장하지 못했어요.');
  return data as Song;
}

export async function listSongs(): Promise<Song[]> {
  const { data, error } = await client().from('songs').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw failed(error, '노래를 불러오지 못했어요.');
  return data as Song[];
}

export async function getSong(id: string): Promise<Song | null> {
  const { data, error } = await client().from('songs').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw failed(error, '노래를 불러오지 못했어요.');
  return data as Song | null;
}

export async function saveOffset(id: string, offset_ms: number): Promise<void> {
  const { error } = await client().from('songs').update({ offset_ms }).eq('id', id);
  if (error) throw failed(error, '싱크를 저장하지 못했어요.');
}

/** Stores a song's edited lyrics, in time order. */
export async function saveLines(id: string, lines: SongLine[]): Promise<SongLine[]> {
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const { error } = await client().from('songs').update({ lines: sorted }).eq('id', id);
  if (error) throw failed(error, '가사를 저장하지 못했어요.');
  return sorted;
}

/** "1:23.45" for 83.45 seconds, as a lyric's start time is written for editing. */
export function formatTime(seconds: number): string {
  const hundredths = Math.round(seconds * 100);
  const sec = (hundredths % 6000) / 100;
  return `${Math.floor(hundredths / 6000)}:${sec.toFixed(2).padStart(5, '0')}`;
}

/** Reads "1:23.45" (or plain seconds, "83.45") back into seconds; null if it isn't a time. */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d+):)?(\d+(?:\.\d*)?)$/);
  if (!m) return null;
  const seconds = Number(m[1] ?? 0) * 60 + Number(m[2]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) / 1000 : null;
}

/** "4:07" for 247 seconds. */
export function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Whether a song's Korean title, Japanese title or artist contains the search text (one search, no commas). */
export function matchesSong(song: Pick<Song, 'title_ko' | 'title_ja' | 'artist'>, query: string): boolean {
  const word = searchable(query);
  return !word || [song.title_ko, song.title_ja, song.artist].some((field) => searchable(field).includes(word));
}
