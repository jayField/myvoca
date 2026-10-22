import chart from '../data/kana-chart.json';

export type KanaCell = [kana: string, romaji: string] | null;
export type KanaScript = 'hiragana' | 'katakana';

export interface KanaSection {
  id: keyof typeof chart;
  title: string;
  columns: string[];
  rows: KanaCell[][];
}

export const KANA_SECTIONS: KanaSection[] = [
  { id: 'basic', title: '기본 (청음)', columns: ['a', 'i', 'u', 'e', 'o'], rows: chart.basic as KanaCell[][] },
  { id: 'dakuon', title: '탁음 · 반탁음', columns: ['a', 'i', 'u', 'e', 'o'], rows: chart.dakuon as KanaCell[][] },
  { id: 'yoon', title: '요음', columns: ['ya', 'yu', 'yo'], rows: chart.yoon as KanaCell[][] },
];

/** Hiragana and katakana sit exactly 0x60 apart in Unicode, small kana included. */
export function toKatakana(hiragana: string): string {
  return hiragana.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function inScript(kana: string, script: KanaScript): string {
  return script === 'katakana' ? toKatakana(kana) : kana;
}
