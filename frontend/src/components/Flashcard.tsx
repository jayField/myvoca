import { useRef, useState } from 'react';
import type { Grade, Item } from '../api';
import { SpeakButton } from './SpeakButton';

const SWIPE_DISTANCE = 90;

interface Props {
  item: Item;
  tag: string;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (grade: Grade) => void;
}

export function Flashcard({ item, tag, flipped, onFlip, onSwipe }: Props) {
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);
  const [dx, setDx] = useState(0);

  function end() {
    if (flipped && Math.abs(dx) > SWIPE_DISTANCE) onSwipe(dx > 0 ? 'good' : 'again');
    startX.current = null;
    setDx(0);
  }

  return (
    <div
      className="flashcard"
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined }}
      onPointerDown={(e) => {
        startX.current = e.clientX;
        dragged.current = false;
      }}
      onPointerMove={(e) => {
        if (startX.current === null) return;
        const delta = e.clientX - startX.current;
        if (Math.abs(delta) > 8) dragged.current = true;
        if (flipped) setDx(delta);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => startX.current !== null && end()}
    >
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
        onClick={() => {
          if (dragged.current) return;
          onFlip();
        }}
      >
        <span lang="ja" className={item.kind === 'kana' ? 'flashcard-term flashcard-term--kana' : 'flashcard-term'}>
          {item.term}
        </span>
        {flipped ? (
          <span className="flashcard-back">
            <span lang={item.kind === 'kana' ? undefined : 'ja'} className="flashcard-reading">
              {item.reading}
            </span>
            {item.kind === 'word' &&<span className="flashcard-meaning">{item.meaning}</span>}
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
