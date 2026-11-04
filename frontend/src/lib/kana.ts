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

const ROMAJI = new Map(
  KANA_SECTIONS.flatMap((s) => s.rows.flat()).flatMap((cell) => (cell ? [[cell[0], cell[1]] as const] : [])),
);

/**
 * Hepburn romaji for a kana reading, built from the kana chart: っ doubles the next consonant,
 * ー repeats the vowel before it, and ん before a vowel or y gets an apostrophe (きんえん → kin'en).
 */
export function toRomaji(kana: string): string {
  const hira = kana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let out = '';
  let double = false;
  for (let i = 0; i < hira.length; i++) {
    const pair = ROMAJI.get(hira.slice(i, i + 2));
    const ch = hira[i];
    let r = pair ?? ROMAJI.get(ch);
    if (pair) i++;
    if (ch === 'っ') {
      double = true;
      continue;
    }
    if (ch === 'ー') {
      out += out.at(-1) ?? '';
      continue;
    }
    if (r === undefined) r = ch;
    if (double) {
      out += r.startsWith('ch') ? 't' : r[0];
      double = false;
    }
    if (out.endsWith('n') && /^[aiueoy]/.test(r) && hira[i - (pair ? 2 : 1)] === 'ん') out += "'";
    out += r;
  }
  return out;
}
