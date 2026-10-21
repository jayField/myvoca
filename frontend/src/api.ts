export type Grade = 'again' | 'hard' | 'good';
export type DeckKind = 'kana' | 'word';
export type OrderMode = 'sequential' | 'random';
export type ItemStatus = 'new' | 'due' | 'learning' | 'mastered';

export interface Item {
  id: number;
  deck_id: string;
  kind: DeckKind;
  term: string;
  reading: string;
  meaning: string;
  example_ja: string | null;
  example_ko: string | null;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  kind: DeckKind;
  total: number;
  learned: number;
  due: number;
}

export interface DeckItem extends Item {
  status: ItemStatus;
  due: string | null;
  last_grade: Grade | null;
}

export interface Settings {
  deck_id: string;
  daily_new: number;
  order: OrderMode;
}

export interface TodayPlan {
  date: string;
  settings: Settings;
  deck_title: string;
  reviews: Item[];
  new_items: Item[];
  new_done: number;
  deck_unlearned: number;
  reviewed_today: number;
}

export interface Stats {
  streak: number;
  learned: number;
  mastered: number;
  reviews_today: number;
  heatmap: { date: string; count: number }[];
}

export interface QuizQuestion {
  item: Item;
  choices: Item[];
}

export interface Quiz {
  deck_id: string;
  source: 'learned' | 'all' | 'confusing';
  questions: QuizQuestion[];
}

export const CONFUSING_DECK_ID = 'confusing';
const DEVICE_KEY = 'myvoca.deviceId';

// crypto.randomUUID is missing outside secure contexts (e.g. a phone opening the dev server by LAN IP).
function newDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let sessionDeviceId: string | null = null;

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newDeviceId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    sessionDeviceId ??= newDeviceId();
    return sessionDeviceId;
  }
}

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId(),
      'X-Local-Date': localDate(),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail && typeof body.detail === 'string' ? body.detail : `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  decks: () => request<{ decks: Deck[]; confusing: number }>('/decks'),
  deckItems: (deckId: string) =>
    request<{ deck: { id: string; title: string; description: string }; items: DeckItem[] }>(
      `/decks/${encodeURIComponent(deckId)}/items`,
    ),
  settings: () => request<Settings>('/settings'),
  saveSettings: (settings: Settings) =>
    request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  today: () => request<TodayPlan>('/today'),
  review: (itemId: number, grade: Grade) =>
    request<{ item_id: number; due: string; interval_days: number }>('/review', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, grade }),
    }),
  stats: () => request<Stats>('/stats'),
  quiz: (deckId: string, count = 10) =>
    request<Quiz>(`/quiz?deck_id=${encodeURIComponent(deckId)}&count=${count}`),
  wordOfDay: () => request<Item>('/word-of-day'),
};

export const SERVER_ERROR = '서버에 연결하지 못했어요. 백엔드가 실행 중인지 확인해 주세요.';
