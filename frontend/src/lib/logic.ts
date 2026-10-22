// Pure study logic over a learner's saved progress. Storage lives in storage.ts.
import type {
  Deck,
  DeckItem,
  DayCount,
  Grade,
  Item,
  ItemStatus,
  Progress,
  Quiz,
  Settings,
  Stats,
  TodayPlan,
} from '../types';
import { CONFUSING_DECK, DECK_BY_ID, DECKS, ITEM_BY_ID, ITEM_ORDER, ITEMS_BY_DECK, WORD_OF_DAY_DECK } from './content';
import { addDays, dayNumber } from './dates';
import { sample, seededRng, shuffle, type Rng } from './random';
import { MASTERED_INTERVAL, NEW_CARD, schedule } from './srs';

export const DEFAULT_SETTINGS: Settings = { deck_id: 'hiragana', daily_new: 10, order: 'sequential' };
export const HEATMAP_DAYS = 140;

const isConfusing = (p: Progress) => p.last_grade === 'again' || p.last_grade === 'hard';
const byOrder = (a: Item, b: Item) => ITEM_ORDER.get(a.id)! - ITEM_ORDER.get(b.id)!;

/** Progress whose item still exists in the bundled lists, keyed by item id. */
function progressMap(progress: Progress[]): Map<string, Progress> {
  return new Map(progress.filter((p) => ITEM_BY_ID.has(p.item_id)).map((p) => [p.item_id, p]));
}

function deckOrThrow(deckId: string) {
  const deck = DECK_BY_ID.get(deckId);
  if (!deck) throw new Error('단어장을 찾을 수 없어요.');
  return deck;
}

function itemStatus(p: Progress | undefined, today: string): ItemStatus {
  if (!p) return 'new';
  if (p.due <= today) return 'due';
  return p.interval_days >= MASTERED_INTERVAL ? 'mastered' : 'learning';
}

export function deckSummaries(progress: Progress[], today: string): { decks: Deck[]; confusing: number } {
  const byItem = progressMap(progress);
  const decks = DECKS.map((deck) => {
    const items = ITEMS_BY_DECK.get(deck.id)!;
    let learned = 0;
    let due = 0;
    for (const item of items) {
      const p = byItem.get(item.id);
      if (!p) continue;
      learned++;
      if (p.due <= today) due++;
    }
    return { ...deck, total: items.length, learned, due };
  });
  const confusing = [...byItem.values()].filter(isConfusing).length;
  return { decks, confusing };
}

export function deckItems(deckId: string, progress: Progress[], today: string) {
  const byItem = progressMap(progress);
  let deck: { id: string; title: string; description: string };
  let items: Item[];
  if (deckId === CONFUSING_DECK.id) {
    deck = CONFUSING_DECK;
    items = [...byItem.values()]
      .filter(isConfusing)
      .map((p) => ITEM_BY_ID.get(p.item_id)!)
      .sort(byOrder);
  } else {
    const { id, title, description } = deckOrThrow(deckId);
    deck = { id, title, description };
    items = ITEMS_BY_DECK.get(deckId)!;
  }
  const rows: DeckItem[] = items.map((item) => {
    const p = byItem.get(item.id);
    return { ...item, status: itemStatus(p, today), due: p?.due ?? null, last_grade: p?.last_grade ?? null };
  });
  return { deck, items: rows };
}

export function planToday(settings: Settings, progress: Progress[], reviewedToday: number, today: string): TodayPlan {
  const deck = deckOrThrow(settings.deck_id);
  const byItem = progressMap(progress);

  const due = [...byItem.values()].filter((p) => p.due <= today);
  due.sort((a, b) => a.due.localeCompare(b.due) || ITEM_ORDER.get(a.item_id)! - ITEM_ORDER.get(b.item_id)!);
  // The daily goal belongs to the chosen range: words started today in other ranges don't use it up.
  const newDone = [...byItem.values()].filter(
    (p) => p.first_seen === today && ITEM_BY_ID.get(p.item_id)!.deck_id === deck.id,
  ).length;

  // New items only ever come from what the learner has not started, so days never overlap.
  let unlearned = ITEMS_BY_DECK.get(deck.id)!.filter((item) => !byItem.has(item.id));
  if (settings.order === 'random') {
    // Seeded by day and deck so reloading the page does not reshuffle today's picks.
    unlearned = shuffle(unlearned, seededRng(`${today}:${deck.id}`));
  }
  const remaining = Math.max(0, settings.daily_new - newDone);

  return {
    date: today,
    settings,
    deck_title: deck.title,
    reviews: due.map((p) => ITEM_BY_ID.get(p.item_id)!),
    new_items: unlearned.slice(0, remaining),
    new_done: newDone,
    deck_unlearned: unlearned.length,
    reviewed_today: reviewedToday,
  };
}

export function applyReview(
  prev: Progress | undefined,
  itemId: string,
  grade: Grade,
  today: string,
  now = new Date().toISOString(),
): Progress {
  const { ease, interval_days, reps, lapses } = schedule(prev ?? NEW_CARD, grade);
  return {
    item_id: itemId,
    ease,
    interval_days,
    reps,
    lapses,
    due: addDays(today, interval_days),
    first_seen: prev?.first_seen ?? today,
    last_grade: grade,
    updated_at: now,
  };
}

export function computeStats(progress: Progress[], days: DayCount[], today: string): Stats {
  const counts = new Map(days.map((d) => [d.day, d.count]));
  // A streak survives until the end of today, so an unstudied today still counts yesterday's run.
  let streak = 0;
  let day = counts.get(today) ? today : addDays(today, -1);
  while (counts.get(day)) {
    streak++;
    day = addDays(day, -1);
  }

  const start = addDays(today, -(HEATMAP_DAYS - 1));
  const heatmap = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(start, i);
    return { date, count: counts.get(date) ?? 0 };
  });

  const known = [...progressMap(progress).values()];
  return {
    streak,
    learned: known.length,
    mastered: known.filter((p) => p.interval_days >= MASTERED_INTERVAL).length,
    reviews_today: counts.get(today) ?? 0,
    heatmap,
  };
}

export function buildQuiz(deckId: string, count: number, progress: Progress[], rng: Rng = Math.random): Quiz {
  const byItem = progressMap(progress);
  let pool: Item[];
  let source: Quiz['source'];
  if (deckId === CONFUSING_DECK.id) {
    pool = [...byItem.values()].filter(isConfusing).map((p) => ITEM_BY_ID.get(p.item_id)!);
    source = 'confusing';
  } else {
    deckOrThrow(deckId);
    const deckItemsAll = ITEMS_BY_DECK.get(deckId)!;
    pool = deckItemsAll.filter((item) => byItem.has(item.id));
    source = 'learned';
    if (pool.length < 4) {
      pool = deckItemsAll;
      source = 'all';
    }
  }

  const questions = sample(pool, count, rng).map((item) => {
    const others = ITEMS_BY_DECK.get(item.deck_id)!.filter((x) => x.meaning !== item.meaning);
    return { item, choices: shuffle([...sample(others, 3, rng), item], rng) };
  });
  return { deck_id: deckId, source, questions };
}

export function wordOfDay(today: string): Item {
  const words = ITEMS_BY_DECK.get(WORD_OF_DAY_DECK)!.filter((item) => item.example_ja);
  return words[dayNumber(today) % words.length];
}
