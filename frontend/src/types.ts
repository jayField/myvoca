export type Grade = 'again' | 'hard' | 'good';
export type DeckKind = 'kana' | 'word';
export type OrderMode = 'sequential' | 'random';
export type ItemStatus = 'new' | 'due' | 'learning' | 'mastered';

export interface Item {
  /** `${deck_id}:${term}` — stable across reordering the bundled word lists. */
  id: string;
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

/** One learner's SRS state for one item, as stored in IndexedDB. */
export interface Progress {
  item_id: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due: string;
  first_seen: string;
  last_grade: Grade;
}

/** Cards graded on one local calendar day. */
export interface DayCount {
  day: string;
  count: number;
}
