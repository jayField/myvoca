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

// Small-vowel combinations that only katakana loanwords use (ファ, ティ, …), which the chart leaves out:
// [kana, romaji, 한글].
const LOANWORD_SOUNDS: [string, string, string][] = [
  ['ふぁ', 'fa', '화'], ['ふぃ', 'fi', '휘'], ['ふぇ', 'fe', '훼'], ['ふぉ', 'fo', '훠'],
  ['てぃ', 'ti', '티'], ['でぃ', 'di', '디'], ['とぅ', 'tu', '투'], ['どぅ', 'du', '두'],
  ['うぃ', 'wi', '위'], ['うぇ', 'we', '웨'], ['うぉ', 'wo', '워'],
  ['しぇ', 'she', '셰'], ['じぇ', 'je', '제'], ['ちぇ', 'che', '체'],
  ['ゔぁ', 'va', '바'], ['ゔぃ', 'vi', '비'], ['ゔ', 'vu', '부'], ['ゔぇ', 've', '베'], ['ゔぉ', 'vo', '보'],
];

const CHART_CELLS = KANA_SECTIONS.flatMap((s) => s.rows.flat()).filter((cell) => cell !== null);
const ROMAJI = new Map([...CHART_CELLS, ...LOANWORD_SOUNDS].map(([kana, romaji]) => [kana, romaji]));
const HANGUL = new Map([...CHART_CELLS, ...LOANWORD_SOUNDS].map(([kana, , hangul]) => [kana, hangul]));

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

/** The sound of a reading as shown to learners: Hangul first, romaji in brackets, e.g. 고한타베타이 (gohantabetai). */
export function pronunciation(kana: string): string {
  return `${toHangul(kana)} (${toRomaji(kana)})`;
}
