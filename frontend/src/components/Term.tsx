import type { Item } from '../api';

/** The word as written at its level; when that is kana, the kanji form sits under it in small type. */
export function Term({ item, className }: { item: Item; className?: string }) {
  const stacked = item.display !== item.term;
  return (
    <span lang="ja" className={[className, stacked && 'term--stacked'].filter(Boolean).join(' ') || undefined}>
      {item.display}
      {stacked && <span className="term-kanji">{item.term}</span>}
    </span>
  );
}

/** The reading is worth showing only when the main form is not already the reading. */
export function showsReading(item: Item): boolean {
  return item.display !== item.reading;
}
