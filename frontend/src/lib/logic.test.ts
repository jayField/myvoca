import { describe, expect, it } from 'vitest';
import type { Progress, Settings } from '../types';
import { DECKS, ITEMS, ITEMS_BY_DECK } from './content';
import { addDays } from './dates';
import { applyReview, buildQuiz, computeStats, deckSummaries, DEFAULT_SETTINGS, planToday } from './logic';
import { NEW_CARD, schedule } from './srs';

const TODAY = '2026-10-21';

function learn(progress: Progress[], itemIds: string[], grade: 'again' | 'hard' | 'good', day = TODAY): Progress[] {
  const byId = new Map(progress.map((p) => [p.item_id, p]));
  for (const id of itemIds) byId.set(id, applyReview(byId.get(id), id, grade, day));
  return [...byId.values()];
}

describe('srs', () => {
  it('grows the interval on good', () => {
    let state = NEW_CARD;
    const intervals = [];
    for (let i = 0; i < 3; i++) {
      state = schedule(state, 'good');
      intervals.push(state.interval_days);
    }
    expect(intervals).toEqual([1, 3, 8]);
  });

  it('resets on again and keeps an ease floor', () => {
    const state = schedule({ ease: 1.3, interval_days: 8, reps: 3, lapses: 0 }, 'again');
    expect(state).toEqual({ ease: 1.3, interval_days: 1, reps: 0, lapses: 1 });
  });
});

describe('planToday', () => {
  it('serves new items in order, then brings them back as reviews without repeating', () => {
    const plan = planToday(DEFAULT_SETTINGS, [], 0, TODAY);
    expect(plan.reviews).toEqual([]);
    expect(plan.new_items.map((i) => i.term).slice(0, 3)).toEqual(['あ', 'い', 'う']);
    expect(plan.new_items).toHaveLength(10);

    const progress = learn([], plan.new_items.map((i) => i.id), 'good');
    const later = planToday(DEFAULT_SETTINGS, progress, 10, TODAY);
    expect(later.new_items).toEqual([]);
    expect(later.new_done).toBe(10);

    const tomorrow = planToday(DEFAULT_SETTINGS, progress, 0, addDays(TODAY, 1));
    expect(tomorrow.reviews).toHaveLength(10);
    expect(tomorrow.new_items[0].term).toBe('さ');
  });

  it('keeps the random pick stable within a day', () => {
    const settings: Settings = { deck_id: 'n5', daily_new: 5, order: 'random' };
    const a = planToday(settings, [], 0, TODAY).new_items.map((i) => i.id);
    const b = planToday(settings, [], 0, TODAY).new_items.map((i) => i.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });

  it('returns only what is left at the end of a deck', () => {
    const settings: Settings = { deck_id: 'hiragana', daily_new: 100, order: 'sequential' };
    const plan = planToday(settings, [], 0, TODAY);
    expect(plan.new_items).toHaveLength(46);
    const progress = learn([], plan.new_items.map((i) => i.id), 'good');
    const next = planToday(settings, progress, 0, addDays(TODAY, 1));
    expect(next.new_items).toEqual([]);
    expect(next.deck_unlearned).toBe(0);
  });

  it('ignores saved progress for items no longer bundled', () => {
    const stale = applyReview(undefined, 'n5:없는단어', 'good', '2026-10-01');
    expect(planToday(DEFAULT_SETTINGS, [stale], 0, TODAY).reviews).toEqual([]);
  });
});

describe('deckSummaries', () => {
  it('collects again and hard into the confusing count', () => {
    const ids = planToday(DEFAULT_SETTINGS, [], 0, TODAY).new_items.map((i) => i.id);
    let progress = learn([], ids.slice(0, 2), 'again');
    progress = learn(progress, ids.slice(2, 3), 'hard');
    progress = learn(progress, ids.slice(3), 'good');
    const { decks, confusing } = deckSummaries(progress, TODAY);
    expect(confusing).toBe(3);
    expect(decks.find((d) => d.id === 'hiragana')).toMatchObject({ total: 46, learned: 10, due: 0 });
  });
});

describe('buildQuiz', () => {
  it('has four distinct choices including the answer', () => {
    const quiz = buildQuiz('n5', 5, []);
    expect(quiz.source).toBe('all');
    expect(quiz.questions).toHaveLength(5);
    for (const q of quiz.questions) {
      const ids = q.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(q.item.id);
    }
  });
});

describe('computeStats', () => {
  it('counts consecutive days and fills the heatmap', () => {
    const days = [
      { day: '2026-10-19', count: 3 },
      { day: '2026-10-20', count: 1 },
      { day: '2026-10-21', count: 2 },
    ];
    const stats = computeStats([], days, TODAY);
    expect(stats.streak).toBe(3);
    expect(stats.heatmap).toHaveLength(140);
    expect(stats.heatmap.at(-1)).toEqual({ date: TODAY, count: 2 });
    expect(computeStats([], days.slice(0, 2), TODAY).streak).toBe(2);
  });
});

describe('content', () => {
  it('offers JLPT N5 to N3 with unique, complete items', () => {
    expect(DECKS.map((d) => d.id)).toEqual(['hiragana', 'katakana', 'n5', 'n4', 'n3']);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) {
      expect(item.reading && item.meaning).toBeTruthy();
    }
    expect(ITEMS_BY_DECK.get('n5')!.length).toBeGreaterThan(300);
  });
});
