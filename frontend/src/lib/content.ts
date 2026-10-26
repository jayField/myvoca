import hiragana from '../data/hiragana.json';
import katakana from '../data/katakana.json';
import n3 from '../data/n3.json';
import n4 from '../data/n4.json';
import n5 from '../data/n5.json';
import type { DeckKind, Item } from '../types';
import { inScript, KANA_SECTIONS, type KanaScript, type KanaSection } from './kana';

interface RawItem {
  term: string;
  /** Set by scripts/apply-notation.mjs when the word is written in kana at this level. */
  display?: string;
  reading: string;
  meaning: string;
  example_ja?: string;
  example_ko?: string;
}

interface DeckDef {
  id: string;
  title: string;
  description: string;
  kind: DeckKind;
  items: RawItem[];
}

/** 탁음·반탁음 and 요음 come straight from the kana chart, so the chart and the kana decks never disagree. */
function chartItems(section: KanaSection['id'], script: KanaScript): RawItem[] {
  const rows = KANA_SECTIONS.find((s) => s.id === section)!.rows;
  return rows.flat().flatMap((cell) => (cell ? [{ term: inScript(cell[0], script), reading: cell[1], meaning: cell[1] }] : []));
}

/** One deck per script: the basic 46 first, then 탁음·반탁음 and 요음, so sequential study goes in that order. */
function kanaDeck(id: KanaScript, title: string, basic: RawItem[]): DeckDef {
  const dakuon = chartItems('dakuon', id);
  const yoon = chartItems('yoon', id);
  return {
    id,
    title,
    description: `기본 ${basic.length}자 · 탁음·반탁음 ${dakuon.length}자 · 요음 ${yoon.length}자`,
    kind: 'kana',
    items: [...basic, ...dakuon, ...yoon],
  };
}

const DECK_DEFS: DeckDef[] = [
  kanaDeck('hiragana', '히라가나', hiragana),
  kanaDeck('katakana', '가타카나', katakana),
  { id: 'n5', title: 'JLPT N5', description: `기초 단어 ${n5.length}개`, kind: 'word', items: n5 },
  { id: 'n4', title: 'JLPT N4', description: `초급 단어 ${n4.length}개`, kind: 'word', items: n4 },
  { id: 'n3', title: 'JLPT N3', description: `중급 단어 ${n3.length}개`, kind: 'word', items: n3 },
];

export const CONFUSING_DECK = { id: 'confusing', title: '헷갈리는 단어', description: '몰랐음·헷갈림으로 표시한 단어' };
export const WORD_OF_DAY_DECK = 'n5';

export const DECKS = DECK_DEFS.map(({ items: _items, ...deck }) => deck);
export const DECK_BY_ID = new Map(DECKS.map((d) => [d.id, d]));

export const ITEMS_BY_DECK = new Map<string, Item[]>(
  DECK_DEFS.map((deck) => [
    deck.id,
    deck.items.map((raw) => ({
      id: `${deck.id}:${raw.term}`,
      deck_id: deck.id,
      kind: deck.kind,
      term: raw.term,
      display: raw.display ?? raw.term,
      reading: raw.reading,
      meaning: raw.meaning,
      example_ja: raw.example_ja ?? null,
      example_ko: raw.example_ko ?? null,
    })),
  ]),
);

export const ITEMS = [...ITEMS_BY_DECK.values()].flat();
export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

/** Position in deck order, then list order; sorting by it matches how the decks are presented. */
export const ITEM_ORDER = new Map(ITEMS.map((item, i) => [item.id, i]));
