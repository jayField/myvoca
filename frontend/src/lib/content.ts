import hiragana from '../data/hiragana.json';
import katakana from '../data/katakana.json';
import n3 from '../data/n3.json';
import n4 from '../data/n4.json';
import n5 from '../data/n5.json';
import type { DeckKind, Item } from '../types';

interface RawItem {
  term: string;
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

const DECK_DEFS: DeckDef[] = [
  { id: 'hiragana', title: '히라가나', description: '기본 46자', kind: 'kana', items: hiragana },
  { id: 'katakana', title: '가타카나', description: '기본 46자', kind: 'kana', items: katakana },
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
