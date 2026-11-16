import chart from '../data/kana-chart.json';

export type KanaCell = [kana: string, romaji: string, hangul: string] | null;
export type KanaScript = 'hiragana' | 'katakana';

export interface KanaSection {
  id: keyof typeof chart;
  title: string;
  /** The vowel kana heading each column (あ단, い단, …). */
  columns: string[];
  rows: KanaCell[][];
}

export const KANA_SECTIONS: KanaSection[] = [
  { id: 'basic', title: '기본 (청음)', columns: ['あ', 'い', 'う', 'え', 'お'], rows: chart.basic as KanaCell[][] },
  { id: 'dakuon', title: '탁음 · 반탁음', columns: ['あ', 'い', 'う', 'え', 'お'], rows: chart.dakuon as KanaCell[][] },
  { id: 'yoon', title: '요음', columns: ['や', 'ゆ', 'よ'], rows: chart.yoon as KanaCell[][] },
];

/** Hiragana and katakana sit exactly 0x60 apart in Unicode, small kana included. */
export function toKatakana(hiragana: string): string {
  return hiragana.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function inScript(kana: string, script: KanaScript): string {
  return script === 'katakana' ? toKatakana(kana) : kana;
}

// Small-vowel combinations that only katakana loanwords use (ファ, ティ, …), which the chart leaves out.
const LOANWORD_SOUNDS: [string, string][] = [
  ['ふぁ', '화'], ['ふぃ', '휘'], ['ふぇ', '훼'], ['ふぉ', '훠'],
  ['てぃ', '티'], ['でぃ', '디'], ['とぅ', '투'], ['どぅ', '두'],
  ['うぃ', '위'], ['うぇ', '웨'], ['うぉ', '워'],
  ['しぇ', '셰'], ['じぇ', '제'], ['ちぇ', '체'],
  ['ゔぁ', '바'], ['ゔぃ', '비'], ['ゔ', '부'], ['ゔぇ', '베'], ['ゔぉ', '보'],
];

const HANGUL = new Map([
  ...KANA_SECTIONS.flatMap((s) => s.rows.flat()).flatMap((cell) => (cell ? [[cell[0], cell[2]] as [string, string]] : [])),
  ...LOANWORD_SOUNDS,
]);

const SYLLABLE_START = 0xac00;
const FINAL_N = 4; // ㄴ
const FINAL_S = 19; // ㅅ

/** Adds a final consonant to the last Hangul syllable when it has none; otherwise leaves the text as it is. */
function withFinal(text: string, final: number): string | null {
  const last = text.charCodeAt(text.length - 1) - SYLLABLE_START;
  if (!(last >= 0 && last < 11172) || last % 28 !== 0) return null;
  return text.slice(0, -1) + String.fromCharCode(SYLLABLE_START + last + final);
}

/**
 * How a kana reading sounds, in Hangul, from the kana chart's 한글 발음: ん becomes a ㄴ final and っ a ㅅ final
 * on the syllable before (こんにちは → 콘니치하, きって → 킷테), and ー is written as a dash (コーヒー → 코-히-).
 */
export function toHangul(kana: string): string {
  const hira = kana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let out = '';
  for (let i = 0; i < hira.length; i++) {
    const two = hira.slice(i, i + 2);
    const pair = two.length === 2 ? HANGUL.get(two) : undefined;
    if (pair) {
      out += pair;
      i++;
      continue;
    }
    const ch = hira[i];
    if (ch === 'ん') out = withFinal(out, FINAL_N) ?? out + '응';
    else if (ch === 'っ') out = withFinal(out, FINAL_S) ?? out;
    else if (ch === 'ー') out += '-';
    else out += HANGUL.get(ch) ?? ch;
  }
  return out;
}
