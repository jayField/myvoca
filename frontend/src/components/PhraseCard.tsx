import type { ReactNode } from 'react';
import type { Phrase } from '../api';
import { phraseSound } from '../lib/phrases';
import { CloseIcon, EditIcon } from './Icons';
import { SpeakButton } from './SpeakButton';

/** One saved phrase as a card: the phrase and its buttons on top, reading, pronunciation and meaning below. */
export function PhraseCard({
  phrase: p,
  handle,
  dragging = false,
  cardRef,
  onEdit,
  onDelete,
}: {
  phrase: Phrase;
  /** A grip for reordering, shown before the phrase. */
  handle?: ReactNode;
  dragging?: boolean;
  cardRef?: (el: HTMLLIElement | null) => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <li ref={cardRef} className={`item-row phrase-card${dragging ? ' is-dragging' : ''}`}>
      <div className="phrase-card-head">
        {handle}
        <span lang="ja" className="talk-term">
          {p.japanese}
        </span>
        <span className="phrase-card-actions">
          <SpeakButton text={p.japanese} />
          {onEdit && (
            <button type="button" className="icon-btn" aria-label={`${p.japanese} 수정`} title="수정" onClick={onEdit}>
              <EditIcon />
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--delete" aria-label={`${p.japanese} 삭제`} title="삭제" onClick={onDelete}>
            <CloseIcon />
          </button>
        </span>
      </div>
      <span className="item-text talk-text">
        {p.reading !== p.japanese && <span lang="ja">{p.reading}</span>}
        <span className="muted">{phraseSound(p)}</span>
      </span>
      <span className="phrase-card-meaning">{p.meaning}</span>
    </li>
  );
}
