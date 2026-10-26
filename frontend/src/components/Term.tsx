import type { Item } from '../api';

/** The word as written at its level; when that is kana, the kanji form follows in small type. */
export function Term({ item, className }: { item: Item; className?: string }) {
  return (
    <span lang="ja" className={className}>
      {item.display}
      {item.display !== item.term && <span className="term-kanji">{item.term}</span>}
    </span>
  );
}

/** The reading is worth showing only when the main form is not already the reading. */
export function showsReading(item: Item): boolean {
  return item.display !== item.reading;
}
