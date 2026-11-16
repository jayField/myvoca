// 1 to 10 in both readings and as a count of people, for the 숫자 page and its quiz.
import type { Item } from '../types';

export const NUMBER_DECK = { id: 'numbers', title: '숫자' };

/**
 * 음독 (Chinese-derived) is for counting and most numbers; 훈독 (native) is the ~つ series for counting
 * things. ~人 counts people: ひとり and ふたり are native, the rest 음독 + にん. Where two readings are in
 * everyday use, the more common one comes first.
 */
export const NUMBERS: { n: number; kanji: string; on: string[]; kun: string; kunWritten: string; people: string[] }[] = [
  { n: 1, kanji: '一', on: ['いち'], kun: 'ひとつ', kunWritten: '一つ', people: ['ひとり'] },
  { n: 2, kanji: '二', on: ['に'], kun: 'ふたつ', kunWritten: '二つ', people: ['ふたり'] },
  { n: 3, kanji: '三', on: ['さん'], kun: 'みっつ', kunWritten: '三つ', people: ['さんにん'] },
  { n: 4, kanji: '四', on: ['よん', 'し'], kun: 'よっつ', kunWritten: '四つ', people: ['よにん'] },
  { n: 5, kanji: '五', on: ['ご'], kun: 'いつつ', kunWritten: '五つ', people: ['ごにん'] },
  { n: 6, kanji: '六', on: ['ろく'], kun: 'むっつ', kunWritten: '六つ', people: ['ろくにん'] },
  { n: 7, kanji: '七', on: ['なな', 'しち'], kun: 'ななつ', kunWritten: '七つ', people: ['ななにん', 'しちにん'] },
  { n: 8, kanji: '八', on: ['はち'], kun: 'やっつ', kunWritten: '八つ', people: ['はちにん'] },
  { n: 9, kanji: '九', on: ['きゅう', 'く'], kun: 'ここのつ', kunWritten: '九つ', people: ['きゅうにん'] },
  // 十 alone would be spoken じゅう, so the counting form is written in kana.
  { n: 10, kanji: '十', on: ['じゅう'], kun: 'とお', kunWritten: 'とお', people: ['じゅうにん'] },
];

/** Separates the readings of a number that has two (よん・し); either one is a right answer. */
export const READING_SEPARATOR = '・';

/** Each number three times as a quiz item: 一 → いち "1" (음독), 一つ → ひとつ "1개" (훈독), 一人 → ひとり "1명". */
export function numberItems(): Item[] {
  return NUMBERS.flatMap(({ n, kanji, on, kun, kunWritten, people }) => [
    {
      id: `${NUMBER_DECK.id}:${kanji}`,
      deck_id: NUMBER_DECK.id,
      kind: 'word' as const,
      term: kanji,
      display: kanji,
      reading: on.join(READING_SEPARATOR),
      meaning: `${n}`,
      example_ja: null,
      example_ko: null,
    },
    {
      id: `${NUMBER_DECK.id}:${kunWritten}`,
      deck_id: NUMBER_DECK.id,
      kind: 'word' as const,
      term: kunWritten,
      display: kunWritten,
      reading: kun,
      meaning: `${n}개`,
      example_ja: null,
      example_ko: null,
    },
    {
      id: `${NUMBER_DECK.id}:${kanji}人`,
      deck_id: NUMBER_DECK.id,
      kind: 'word' as const,
      term: `${kanji}人`,
      display: `${kanji}人`,
      reading: people.join(READING_SEPARATOR),
      meaning: `${n}명`,
      example_ja: null,
      example_ko: null,
    },
  ]);
}
