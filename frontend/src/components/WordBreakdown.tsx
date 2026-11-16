import type { PhraseWord } from '../api';
import { toHangul } from '../lib/kana';

/** A phrase split into its words, each with how it sounds and what it means. Nothing for a one-word phrase. */
export function WordBreakdown({ words }: { words: PhraseWord[] }) {
  if (words.length < 2) return null;
  return (
    <ol className="word-breakdown" aria-label="단어별 뜻">
      {words.map((w, i) => (
        <li key={i} className="word-chip">
          <span lang="ja" className="word-chip-ja">
            {w.japanese}
          </span>
          <span className="word-chip-sound">{toHangul(w.reading)}</span>
          <span className="word-chip-meaning">{w.meaning}</span>
        </li>
      ))}
    </ol>
  );
}
