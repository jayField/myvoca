import { DAILY_DAYS, DAILY_WORDS, dailyLabel, dayTest, dayWords, parseDay } from './daily';
import { describe, expect, it } from 'vitest';
import type { Phrase, Progress, Settings } from '../types';
import { DECKS, ITEMS, ITEMS_BY_DECK } from './content';
import { addDays } from './dates';
import { toHangul } from './kana';
import { groupName, inGroup, matchesSearch, mergeOrder, phraseSound } from './phrases';
import { seededRng } from './random';
import { clock, formatTime, lineAt, matchesSong, parseLrc, parseTime, rankMatches, youtubeId } from './songs';
import {
  applyReview,
  buildPhraseQuiz,
  buildQuiz,
  computeStats,
  deckItems,
  deckSummaries,
  DEFAULT_SETTINGS,
  gradesOnDay,
  keepThroughReset,
  planToday,
  studyLog,
} from './logic';
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
  it('serves new items in order without repeating, and known words are not reviews', () => {
    const plan = planToday(DEFAULT_SETTINGS, [], 0, TODAY);
    expect(plan.reviews).toEqual([]);
    expect(plan.new_items.map((i) => i.term).slice(0, 3)).toEqual(['あ', 'い', 'う']);
    expect(plan.new_items).toHaveLength(10);

    const progress = learn([], plan.new_items.map((i) => i.id), 'good');
    const later = planToday(DEFAULT_SETTINGS, progress, 10, TODAY);
    expect(later.new_items).toEqual([]);
    expect(later.new_done).toBe(10);

    const tomorrow = planToday(DEFAULT_SETTINGS, progress, 0, addDays(TODAY, 1));
    expect(tomorrow.reviews).toEqual([]);
    expect(tomorrow.new_items[0].term).toBe('さ');
  });

  it('counts the daily goal per range, so switching or resetting a range starts it fresh', () => {
    const hiragana = planToday(DEFAULT_SETTINGS, [], 0, TODAY).new_items.map((i) => i.id);
    const progress = learn([], hiragana, 'good');
    const n5: Settings = { deck_id: 'n5', daily_new: 20, order: 'sequential', include_reviews: true };
    const plan = planToday(n5, progress, 10, TODAY);
    expect(plan.new_done).toBe(0);
    expect(plan.new_items).toHaveLength(20);
  });

  it('reviews five random confusing words from the chosen range only, none on the day they were first met', () => {
    const n5: Settings = { deck_id: 'n5', daily_new: 10, order: 'sequential', include_reviews: true };
    const words = planToday(n5, [], 0, TODAY).new_items.map((i) => i.id);
    const progress = learn([], words, 'again');
    const tomorrow = addDays(TODAY, 1);
    expect(planToday(n5, progress, 0, TODAY).reviews).toEqual([]);
    const reviews = planToday(n5, progress, 0, tomorrow).reviews.map((i) => i.id);
    expect(reviews).toHaveLength(5);
    expect(new Set(reviews).size).toBe(5);
    expect(reviews.every((id) => words.includes(id))).toBe(true);
    // N5's confusing words stay with N5: studying ひらがな brings none of them.
    expect(planToday(DEFAULT_SETTINGS, progress, 0, tomorrow).reviews).toEqual([]);
  });

  it('with 전부, reviews as many confusing words a day as the daily new count', () => {
    const n5: Settings = { deck_id: 'n5', daily_new: 20, order: 'sequential', include_reviews: true, all_reviews: true };
    const words = planToday(n5, [], 0, TODAY).new_items.map((i) => i.id);
    let progress = learn([], words.slice(0, 18), 'again');
    progress = learn(progress, words.slice(18), 'good');
    const hira = planToday(DEFAULT_SETTINGS, [], 0, TODAY).new_items.map((i) => i.id);
    progress = learn(progress, hira, 'again');
    const tomorrow = addDays(TODAY, 1);
    // 18 confusing N5 words, all fit under 20; ひらがな's stay out.
    const reviews = planToday(n5, progress, 0, tomorrow).reviews.map((i) => i.id);
    expect(reviews.sort()).toEqual(words.slice(0, 18).sort());
    // With 10 a day only 10 come, and resuming after 6 brings the other 4.
    const ten = { ...n5, daily_new: 10 };
    const first = planToday(ten, progress, 0, tomorrow).reviews.map((i) => i.id);
    expect(first).toHaveLength(10);
    progress = learn(progress, first.slice(0, 6), 'good', tomorrow);
    expect(planToday(ten, progress, 6, tomorrow).reviews).toHaveLength(4);
  });

  it('keeps reviews to five a day across sessions without repeating a word', () => {
    const n5: Settings = { deck_id: 'n5', daily_new: 10, order: 'sequential', include_reviews: true };
    const words = planToday(n5, [], 0, TODAY).new_items.map((i) => i.id);
    let progress = learn([], words, 'again');
    const tomorrow = addDays(TODAY, 1);
    const first = words.slice(0, 2);
    progress = learn(progress, first, 'good', tomorrow);
    expect(planToday(n5, progress, 2, tomorrow).reviews_done).toBe(2);
    const resumed = planToday(n5, progress, 2, tomorrow).reviews.map((i) => i.id);
    expect(resumed).toHaveLength(3);
    expect(resumed.some((id) => first.includes(id))).toBe(false);
    progress = learn(progress, resumed, 'again', tomorrow);
    expect(planToday(n5, progress, 5, tomorrow).reviews).toEqual([]);
    expect(planToday(n5, progress, 0, addDays(tomorrow, 1)).reviews).toHaveLength(5);
  });

  it('serves new items only with reviews off, and brings confusing words back when switched on', () => {
    const first = planToday(DEFAULT_SETTINGS, [], 0, TODAY).new_items.map((i) => i.id);
    const progress = learn([], first, 'again');
    const tomorrow = addDays(TODAY, 1);
    const off = planToday({ ...DEFAULT_SETTINGS, include_reviews: false }, progress, 0, tomorrow);
    expect(off.reviews).toEqual([]);
    expect(off.new_items).toHaveLength(10);
    expect(planToday(DEFAULT_SETTINGS, progress, 0, tomorrow).reviews).toHaveLength(5);
  });

  it('picks different words each time in random mode', () => {
    const settings: Settings = { deck_id: 'n5', daily_new: 5, order: 'random', include_reviews: true };
    const a = planToday(settings, [], 0, TODAY, seededRng('first')).new_items.map((i) => i.id);
    const b = planToday(settings, [], 0, TODAY, seededRng('second')).new_items.map((i) => i.id);
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(5);
  });

  it('returns only what is left at the end of a deck', () => {
    const settings: Settings = { deck_id: 'hiragana', daily_new: 200, order: 'sequential', include_reviews: true };
    const plan = planToday(settings, [], 0, TODAY);
    expect(plan.new_items).toHaveLength(104);
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
    expect(decks.find((d) => d.id === 'hiragana')).toMatchObject({ total: 104, learned: 10, due: 0 });
  });
});

describe('buildQuiz', () => {
  it('has four distinct choices including the answer', () => {
    const quiz = buildQuiz('n5', 5, []);
    expect(quiz.source).toBe('mixed');
    expect(quiz.questions).toHaveLength(5);
    for (const q of quiz.questions) {
      const ids = q.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(q.item.id);
    }
  });
});

describe('buildPhraseQuiz', () => {
  const phrase = (id: string, meaning: string) => ({
    id: `talk:${id}`, deck_id: 'talk', kind: 'word' as const, term: id, display: id, reading: id, meaning, example_ja: null, example_ko: null,
  });

  it('asks saved phrases with four distinct choices, topping up with N5 words when few are saved', () => {
    const quiz = buildPhraseQuiz([phrase('ありがとう', '고마워'), phrase('おやすみ', '잘 자')], 10, seededRng('talk'));
    expect(quiz.questions).toHaveLength(2);
    for (const q of quiz.questions) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(4);
      expect(q.choices).toContain(q.item);
    }
  });

  it('has no questions when nothing is saved', () => {
    expect(buildPhraseQuiz([], 10).questions).toEqual([]);
  });
});

describe('studyLog', () => {
  it('lists words on the day first met and the latest study day, newest first', () => {
    const tomorrow = addDays(TODAY, 1);
    let progress = learn([], ['n5:猫', 'n5:犬'], 'again');
    progress = learn(progress, ['n5:猫'], 'good', tomorrow);
    const log = studyLog(progress);
    expect(log.map((d) => d.day)).toEqual([tomorrow, TODAY]);
    expect(log[0].entries).toMatchObject([{ item: { id: 'n5:猫' }, kind: 'review', grade: 'good' }]);
    expect(log[1].entries).toMatchObject([
      { item: { id: 'n5:猫' }, kind: 'new', grade: null },
      { item: { id: 'n5:犬' }, kind: 'new', grade: 'again' },
    ]);
  });

  it('leaves out a reset deck', () => {
    expect(studyLog([keepThroughReset(applyReview(undefined, 'n5:猫', 'again', TODAY), TODAY)])).toEqual([]);
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

describe('phraseSound', () => {
  it('spaces a phrase Korean-style from its word breakdown, joining particles to the word before', () => {
    const words = [
      { japanese: '君', reading: 'きみ', meaning: '너' },
      { japanese: 'を', reading: 'を', meaning: '을/를', attach: true },
      { japanese: '思っている', reading: 'おもっている', meaning: '생각하고 있다' },
    ];
    expect(phraseSound({ reading: 'きみをおもっている', words })).toBe('키미오 오못테이루');
    expect(phraseSound({ reading: 'おやすみ', words: [] })).toBe('오야스미');
  });
});

describe('toHangul', () => {
  it('writes how a reading sounds in Hangul, with ん and っ as finals', () => {
    expect(toHangul('ねこ')).toBe('네코');
    expect(toHangul('しんぶん')).toBe('신분');
    expect(toHangul('きって')).toBe('킷테');
    expect(toHangul('コーヒー')).toBe('코-히-');
    expect(toHangul('ファイル')).toBe('화이루');
    expect(toHangul('ごはんたべたい')).toBe('고한타베타이');
    expect(toHangul('パーティー')).toBe('파-티-');
  });
});

describe('content', () => {
  it('offers kana and JLPT N5 to N3 with unique, complete items', () => {
    expect(DECKS.map((d) => d.id)).toEqual(['hiragana', 'katakana', 'n5', 'n4', 'n3']);
    // Basic 46, then 탁음·반탁음 25, then 요음 33.
    const katakana = ITEMS_BY_DECK.get('katakana')!.map((i) => i.term);
    expect(katakana).toHaveLength(104);
    expect([katakana[0], katakana[46], katakana[71]]).toEqual(['ア', 'ガ', 'キャ']);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) {
      expect(item.reading && item.meaning).toBeTruthy();
    }
    expect(ITEMS_BY_DECK.get('n5')!.length).toBeGreaterThan(300);
  });
});

describe('gradesOnDay', () => {
  it('counts study cards once by their latest study grade and leaves quizzes out', () => {
    let progress = learn([], ['n5:猫', 'n5:犬', 'n5:水'], 'again', TODAY);
    progress = learn(progress, ['n5:猫'], 'good', TODAY);
    // A quiz grade changes review state but not today's study results.
    progress = progress.map((p) => (p.item_id === 'n5:水' ? applyReview(p, p.item_id, 'good', TODAY, undefined, 'quiz') : p));
    progress.push(applyReview(undefined, 'n5:本', 'again', TODAY, undefined, 'quiz'));
    progress.push(applyReview(undefined, 'n5:山', 'hard', '2026-10-20'));
    expect(gradesOnDay(progress, TODAY)).toEqual({ good: 1, hard: 0, again: 2 });
  });
});

describe('quiz grades and the daily goal', () => {
  it('a word a quiz adds today does not use up the daily new-word goal', () => {
    const settings: Settings = { deck_id: 'n5', daily_new: 5, order: 'sequential', include_reviews: true };
    const fromQuiz = applyReview(undefined, 'n5:猫', 'again', TODAY, undefined, 'quiz');
    const plan = planToday(settings, [fromQuiz], 0, TODAY);
    expect(plan.new_done).toBe(0);
    expect(plan.new_items).toHaveLength(5);
    expect(plan.new_items.map((i) => i.id)).not.toContain('n5:猫');
    expect(deckSummaries([fromQuiz], TODAY).confusing).toBe(1);
  });
});

describe('confusing words', () => {
  it('stay listed under the day they were missed, marked recovered once known on a later day', () => {
    const day = (iso: string) => iso.slice(0, 10);
    let p = applyReview(undefined, 'n5:猫', 'again', TODAY, `${TODAY}T01:00:00.000Z`);
    p = applyReview(p, 'n5:猫', 'good', TODAY, `${TODAY}T02:00:00.000Z`);
    expect(deckItems('confusing', [p], TODAY, day).items[0]).toMatchObject({ missed_day: TODAY, recovered: false });

    const next = addDays(TODAY, 1);
    p = applyReview(p, 'n5:猫', 'good', next, `${next}T01:00:00.000Z`);
    expect(deckSummaries([p], next).confusing).toBe(1);
    expect(deckItems('confusing', [p], next, day).items[0]).toMatchObject({ missed_day: TODAY, recovered: true });

    const later = addDays(TODAY, 4);
    p = applyReview(p, 'n5:猫', 'hard', later, `${later}T01:00:00.000Z`);
    expect(deckItems('confusing', [p], later, day).items[0]).toMatchObject({ missed_day: later, recovered: false });
  });
});

describe('confusing words through a deck reset', () => {
  it('stay listed while the deck starts over, and start over as new cards when studied again', () => {
    const missed = applyReview(undefined, 'n5:猫', 'again', TODAY);
    const kept = keepThroughReset(missed, TODAY);
    const settings: Settings = { deck_id: 'n5', daily_new: 5, order: 'sequential', include_reviews: true };

    expect(deckSummaries([kept], TODAY)).toMatchObject({ confusing: 1 });
    expect(deckSummaries([kept], TODAY).decks.find((d) => d.id === 'n5')).toMatchObject({ learned: 0, due: 0 });
    expect(deckItems('confusing', [kept], TODAY).items[0]).toMatchObject({ term: '猫', status: 'new', missed_day: TODAY });
    expect(planToday(settings, [kept], 0, TODAY).new_items[0].id).toBe('n5:猫');
    expect(planToday(settings, [kept], 0, TODAY).reviews).toEqual([]);

    const next = addDays(TODAY, 1);
    const again = applyReview(kept, 'n5:猫', 'good', next);
    expect(again).toMatchObject({ reset_on: null, reps: 1, lapses: 0, first_seen: next, missed_on: TODAY });
  });
});

describe('confusing words by day', () => {
  it('lists the most recently missed day first, each word tagged with its day', () => {
    const older = applyReview(undefined, 'n5:犬', 'again', '2026-10-20');
    const newer = applyReview(undefined, 'n5:猫', 'hard', TODAY);
    const { items } = deckItems('confusing', [older, newer], TODAY);
    expect(items.map((i) => [i.term, i.missed_day])).toEqual([
      ['猫', TODAY],
      ['犬', '2026-10-20'],
    ]);
  });
});

describe('quiz size', () => {
  it('tops up a range with only a few studied words so the quiz has the chosen count', () => {
    const studied = ITEMS_BY_DECK.get('n5')!.slice(0, 9).map((i) => i.id);
    const quiz = buildQuiz('n5', 10, learn([], studied, 'good'));
    expect(quiz.questions).toHaveLength(10);
    expect(quiz.source).toBe('mixed');
    const ids = quiz.questions.map((q) => q.item.id);
    expect(new Set(ids).size).toBe(10);
    expect(studied.every((id) => ids.includes(id))).toBe(true);
  });
});

describe('pageBreaks', () => {
  it('cuts between entries and only cuts through one taller than a page', async () => {
    const { pageBreaks } = await import('./phrasePdf');
    expect(pageBreaks([40, 90, 140, 190], 190, 100)).toEqual([0, 90, 190]);
    expect(pageBreaks([30, 300], 300, 100)).toEqual([0, 30, 130, 230, 300]);
    expect(pageBreaks([50], 50, 100)).toEqual([0, 50]);
  });
});

describe('typed pronunciations', () => {
  it('wins over the automatic one, and empty means automatic', async () => {
    const { phraseSound } = await import('./phrases');
    expect(phraseSound({ reading: 'ねこ', words: [], sound: '냐옹' })).toBe('냐옹');
    expect(phraseSound({ reading: 'ねこ', words: [], sound: '' })).toBe('네코');
  });
});

describe('numbers quiz', () => {
  it('asks each number in both readings, with choices from the numbers', async () => {
    const { numberItems } = await import('./numbers');
    const items = numberItems();
    expect(items).toHaveLength(30);
    expect(items.find((i) => i.term === '七人')).toMatchObject({ reading: 'ななにん・しちにん', meaning: '7명' });
    expect(items.find((i) => i.term === '四')).toMatchObject({ reading: 'よん・し', meaning: '4' });
    expect(items.find((i) => i.term === '四つ')).toMatchObject({ reading: 'よっつ', meaning: '4개' });
    const quiz = buildPhraseQuiz(items, 10, seededRng('numbers'));
    expect(quiz.questions).toHaveLength(10);
    for (const q of quiz.questions) expect(q.choices.every((c) => c.deck_id === 'numbers')).toBe(true);
  });
});

describe('pronunciation grammar', () => {
  it('stretches long vowels instead of saying them twice', () => {
    expect(toHangul('べんきょう')).toBe('벤쿄-');
    expect(toHangul('せんせい')).toBe('센세-');
    expect(toHangul('ありがとう')).toBe('아리가토-');
    expect(toHangul('おかあさん')).toBe('오카-산');
    expect(toHangul('こんにちは')).toBe('콘니치와');
  });
  it('keeps vowels that are said in full', () => {
    expect(toHangul('おもう')).toBe('오모우');
    expect(toHangul('たべている')).toBe('타베테이루');
    expect(toHangul('ごはんたべたい')).toBe('고한타베타이');
    expect(toHangul('またあした')).toBe('마타아시타');
    expect(toHangul('がっこうにいきます')).toBe('갓코-니이키마스');
    expect(toHangul('おいしい')).toBe('오이시이');
  });
  it('says the particles は and へ as 와 and 에', () => {
    const words = [
      { japanese: '私', reading: 'わたし' },
      { japanese: 'は', reading: 'は', attach: true },
      { japanese: '日本語', reading: 'にほんご' },
      { japanese: 'の', reading: 'の', attach: true },
      { japanese: '勉強', reading: 'べんきょう' },
      { japanese: 'を', reading: 'を', attach: true },
      { japanese: '熱心に', reading: 'ねっしんに' },
      { japanese: 'しています', reading: 'しています' },
    ];
    expect(phraseSound({ reading: '', words })).toBe('와타시와 니혼고노 벤쿄-오 넷신니 시테이마스');
    expect(phraseSound({ reading: '', words: [{ japanese: '学校', reading: 'がっこう' }, { japanese: 'へ', reading: 'へ', attach: true }] })).toBe('갓코-에');
  });
});

describe('placeAt', () => {
  const at = (id: string, position: number | null) => ({ id, position }) as unknown as Phrase;
  it('puts a moved phrase halfway between its new neighbours', async () => {
    const { placeAt } = await import('./phrases');
    expect(placeAt([at('a', 1), at('x', 9), at('b', 2)], 1)).toEqual([{ id: 'x', position: 1.5 }]);
    expect(placeAt([at('x', 9), at('a', 1)], 0)).toEqual([{ id: 'x', position: 0 }]);
    expect(placeAt([at('a', 1), at('x', -5)], 1)).toEqual([{ id: 'x', position: 2 }]);
  });
  it('renumbers everything when a neighbour has no position yet', async () => {
    const { placeAt } = await import('./phrases');
    expect(placeAt([at('a', null), at('x', 5), at('b', null)], 1)).toEqual([
      { id: 'a', position: 0 },
      { id: 'x', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });
});

describe('회화 노트 search', () => {
  const p = {
    id: '1', input: '오해하지마', japanese: '誤解しないで', reading: 'ごかいしないで', meaning: '오해하지 마',
    sound: '', words: [], position: 1, group_id: null, created_at: '',
  } as Phrase;
  it('finds by Japanese, reading in either kana, pronunciation and meaning, ignoring spaces', () => {
    for (const q of ['誤解', 'ごかい', 'ゴカイ', '고카이', '오해 하지', '  ']) expect(matchesSearch(p, q)).toBe(true);
    expect(matchesSearch(p, '대답')).toBe(false);
  });
  it('treats commas as "or"', () => {
    expect(matchesSearch(p, '대답, 오해')).toBe(true);
    expect(matchesSearch(p, '대답、닥쳐')).toBe(false);
    expect(matchesSearch(p, ' , ')).toBe(true);
  });
});

describe('particles after particles', () => {
  it('says には / では / へは with 와', () => {
    const words = [
      { japanese: '時', reading: 'とき' },
      { japanese: 'には', reading: 'には', attach: true },
    ];
    expect(phraseSound({ reading: 'ときには', words })).toBe('토키니와');
    expect(phraseSound({ reading: 'がっこうでは', words: [{ japanese: '学校', reading: 'がっこう' }, { japanese: 'では', reading: 'では', attach: true }] })).toBe('갓코-데와');
    // Not a particle: はは (母) as a word keeps its sound.
    expect(phraseSound({ reading: 'はは', words: [{ japanese: '母', reading: 'はは' }, { japanese: 'は', reading: 'は', attach: true }] })).toBe('하하와');
  });
});

describe('노래', () => {
  it('reads the video ID from any YouTube link', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=v4-CI-xClCM',
      'https://youtube.com/watch?feature=share&v=v4-CI-xClCM&t=10',
      'youtu.be/v4-CI-xClCM?si=abc',
      'https://m.youtube.com/shorts/v4-CI-xClCM',
      'https://music.youtube.com/watch?v=v4-CI-xClCM',
      'v4-CI-xClCM',
    ]) expect(youtubeId(link)).toBe('v4-CI-xClCM');
    expect(youtubeId('https://example.com/watch?v=v4-CI-xClCM')).toBeNull();
    expect(youtubeId('도라에몽')).toBeNull();
  });
  it('parses timed lyrics, keeping breaks and repeating multi-stamp lines', () => {
    const lrc = '[ar:mao]\n[00:08.25] 心の中\n[00:10.06]いつもいつも\n[01:28.21] \n[00:05.00][01:30.5]シャララ';
    expect(parseLrc(lrc)).toEqual([
      { t: 5, text: 'シャララ' },
      { t: 8.25, text: '心の中' },
      { t: 10.06, text: 'いつもいつも' },
      { t: 88.21, text: '' },
      { t: 90.5, text: 'シャララ' },
    ]);
  });
  it('finds the line being sung, shifted by the sync offset', () => {
    const lines = [{ t: 8 }, { t: 10 }, { t: 12 }];
    expect(lineAt(lines, 7)).toBe(-1);
    expect(lineAt(lines, 10.5)).toBe(1);
    expect(lineAt(lines, 99)).toBe(2);
    expect(lineAt(lines, 10.5, 1)).toBe(0);
    expect(clock(247)).toBe('4:07');
    expect(clock(59.6)).toBe('1:00');
  });
  it('writes and reads lyric start times', () => {
    expect(formatTime(8.12)).toBe('0:08.12');
    expect(formatTime(83.456)).toBe('1:23.46');
    expect(formatTime(119.999)).toBe('2:00.00');
    expect(parseTime('1:23.45')).toBe(83.45);
    expect(parseTime(' 83.5 ')).toBe(83.5);
    expect(parseTime('0:08')).toBe(8);
    expect(parseTime(formatTime(247.3))).toBe(247.3);
    for (const bad of ['', 'abc', '1:2:3', '-3']) expect(parseTime(bad)).toBeNull();
  });
  it('lists the song itself first, finer-cut lyrics before coarser', () => {
    const m = (id: number, track: string, lrc: string) => ({ id, track, artist: 'mao', duration: 247, lrc });
    const ranked = rankMatches(
      [m(1, '夢をかなえてドラえもん', '[00:01]心の中 いつもいつも'), m(2, '夢をかなえてドラえもん (カラオケ)', '[00:01]a\n[00:02]b\n[00:03]c'), m(3, '夢をかなえてドラえもん', '[00:01]心の中\n[00:02]いつもいつも')],
      '夢をかなえてドラえもん',
    );
    expect(ranked.map((x) => x.id)).toEqual([3, 1, 2]);
  });
});

describe('matchesSong', () => {
  const song = { title_ko: '도라에몽', title_ja: '夢をかなえてドラえもん', artist: 'mao' };
  it('finds by either title or artist, ignoring spaces, case and kana kind', () => {
    expect(matchesSong(song, '도라 에몽')).toBe(true);
    expect(matchesSong(song, 'どらえもん')).toBe(true);
    expect(matchesSong(song, 'MAO')).toBe(true);
    expect(matchesSong(song, '')).toBe(true);
    expect(matchesSong(song, '드라이플라워')).toBe(false);
  });
});

describe('회화 노트 groups', () => {
  const P = (id: string, group_id: string | null) => ({ id, group_id }) as Phrase;
  const list = [P('a', 'g1'), P('b', null), P('c', 'g1'), P('d', 'g2'), P('e', 'g1')];
  it('shows everything, 미분류 only, or one group', () => {
    expect(list.filter((p) => inGroup(p, 'all'))).toHaveLength(5);
    expect(list.filter((p) => inGroup(p, 'none')).map((p) => p.id)).toEqual(['b']);
    expect(list.filter((p) => inGroup(p, 'g1')).map((p) => p.id)).toEqual(['a', 'c', 'e']);
  });
  it('reorders inside a group without moving the other phrases', () => {
    const merged = mergeOrder(list, [P('e', 'g1'), P('a', 'g1'), P('c', 'g1')], 'g1');
    expect(merged.map((p) => p.id)).toEqual(['e', 'b', 'a', 'd', 'c']);
  });
  it('takes a group name trimmed, up to 30 characters, and refuses a blank one', () => {
    expect(groupName('  식당 ')).toBe('식당');
    expect(groupName('   ')).toBeNull();
    expect(groupName(null)).toBeNull();
    expect(groupName('가'.repeat(40))).toHaveLength(30);
  });
});

describe('하루 단어', () => {
  it('splits N5, then N4, then N3 into days of ten', () => {
    expect(DAILY_WORDS[0].deck_id).toBe('n5');
    expect(DAILY_WORDS.at(-1)!.deck_id).toBe('n3');
    expect(dayWords(1)).toHaveLength(10);
    expect(dayWords(2)[0]).toBe(DAILY_WORDS[10]);
    expect(dayWords(DAILY_DAYS).length).toBeGreaterThan(0);
  });

  it('tests day 1 alone, day 2 with all of day 1, later days with twenty from day 1 through that day', () => {
    expect(dayTest(1)).toHaveLength(10);
    const two = dayTest(2);
    expect(two).toHaveLength(20);
    expect(new Set(two.filter((c) => c.earlier).map((c) => c.item.id))).toEqual(new Set(dayWords(1).map((w) => w.id)));
    const five = dayTest(5, seededRng('five'));
    expect(five).toHaveLength(20);
    expect(new Set(five.map((c) => c.item.id)).size).toBe(20);
    expect(five.every((c) => DAILY_WORDS.indexOf(c.item) < 50)).toBe(true);
    expect(five.every((c) => c.earlier === DAILY_WORDS.indexOf(c.item) < 40)).toBe(true);
    // Over many draws, today's words and earlier ones both turn up.
    const seen = new Set(Array.from({ length: 30 }, (_, i) => dayTest(5, seededRng(`d${i}`))).flat().map((c) => c.earlier));
    expect(seen).toEqual(new Set([true, false]));
  });

  it('writes words as ひらがな(漢字), and kana-only words as they are', () => {
    expect(dailyLabel({ term: '猫', reading: 'ねこ' })).toBe('ねこ(猫)');
    expect(dailyLabel({ term: 'コーヒー', reading: 'こーひー' })).toBe('コーヒー');
    expect(dailyLabel({ term: 'ありがとう', reading: 'ありがとう' })).toBe('ありがとう');
  });

  it('only accepts days that exist', () => {
    expect(parseDay('1')).toBe(1);
    expect(parseDay('0')).toBeNull();
    expect(parseDay('1.5')).toBeNull();
    expect(parseDay(String(DAILY_DAYS + 1))).toBeNull();
  });
});
