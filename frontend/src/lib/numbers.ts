// 1 to 10 in both readings, for the 숫자 page and its quiz.
import type { Item } from '../types';

export const NUMBER_DECK = { id: 'numbers', title: '숫자' };

/**
 * 음독 (Chinese-derived) is for counting and most numbers; 훈독 (native) is the ~つ series for counting
 * things. Where two 음독 are in everyday use, the more common one comes first.
 */
export const NUMBERS: { n: number; kanji: string; on: string[]; kun: string; kunWritten: string }[] = [
  { n: 1, kanji: '一', on: ['いち'], kun: 'ひとつ', kunWritten: '一つ' },
  { n: 2, kanji: '二', on: ['に'], kun: 'ふたつ', kunWritten: '二つ' },
  { n: 3, kanji: '三', on: ['さん'], kun: 'みっつ', kunWritten: '三つ' },
  { n: 4, kanji: '四', on: ['よん', 'し'], kun: 'よっつ', kunWritten: '四つ' },
  { n: 5, kanji: '五', on: ['ご'], kun: 'いつつ', kunWritten: '五つ' },
  { n: 6, kanji: '六', on: ['ろく'], kun: 'むっつ', kunWritten: '六つ' },
  { n: 7, kanji: '七', on: ['なな', 'しち'], kun: 'ななつ', kunWritten: '七つ' },
  { n: 8, kanji: '八', on: ['はち'], kun: 'やっつ', kunWritten: '八つ' },
  { n: 9, kanji: '九', on: ['きゅう', 'く'], kun: 'ここのつ', kunWritten: '九つ' },
  // 十 alone would be spoken じゅう, so the counting form is written in kana.
  { n: 10, kanji: '十', on: ['じゅう'], kun: 'とお', kunWritten: 'とお' },
];

/** Separates the readings of a number that has two (よん・し); either one is a right answer. */
export const READING_SEPARATOR = '・';

/** Each number twice as a quiz item: 一 → いち "1" (음독) and 一つ → ひとつ "1개" (훈독). */
export function numberItems(): Item[] {
  return NUMBERS.flatMap(({ n, kanji, on, kun, kunWritten }) => [
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
  ]);
}
