import type { Item } from '../api';
import { SpeakButton } from './SpeakButton';
import { showsReading, Term } from './Term';

interface Props {
  item: Item;
  tag: string;
  flipped: boolean;
  onFlip: () => void;
}

export function Flashcard({ item, tag, flipped, onFlip }: Props) {
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
            {item.kind === 'word' && <span className="flashcard-meaning">{item.meaning}</span>}
            {item.example_ja && (
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
