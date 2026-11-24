import type { Item } from '../api';
import { toHangul } from '../lib/kana';
import { SpeakButton } from './SpeakButton';
import { showsReading, Term } from './Term';

interface Props {
  item: Item;
  tag: string;
  flipped: boolean;
  onFlip: () => void;
  /** Leave the example sentence off the back, for tests that are about the word alone (하루 단어). */
  hideExample?: boolean;
}

export function Flashcard({ item, tag, flipped, onFlip, hideExample = false }: Props) {
  return (
    <div className="flashcard">
      <span className="flashcard-tag">{tag}</span>
      {flipped && (
        <div className="flashcard-speak">
          <SpeakButton text={item.term} />
        </div>
      )}
      <button
        type="button"
        className="flashcard-face"
        aria-label={flipped ? `${item.term}, 뒷면` : `${item.term}, 눌러서 뒤집기`}
        onClick={onFlip}
      >
        <Term item={item} className={item.kind === 'kana' ? 'flashcard-term flashcard-term--kana' : 'flashcard-term'} />
        {flipped ? (
          <span className="flashcard-back">
            {showsReading(item) && (
              <span lang={item.kind === 'kana' ? undefined : 'ja'} className="flashcard-reading">
                {item.reading}
              </span>
            )}
            {item.kind === 'word' && <span className="flashcard-sound">{toHangul(item.reading)}</span>}
            {item.kind === 'word' && <span className="flashcard-meaning">{item.meaning}</span>}
            {item.example_ja && !hideExample && (
              <span className="flashcard-example">
                <span lang="ja">{item.example_ja}</span>
                <span>{item.example_ko}</span>
              </span>
            )}
          </span>
        ) : (
          <span className="flashcard-hint">탭해서 뒤집기</span>
        )}
      </button>
    </div>
  );
}
