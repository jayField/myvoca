import type { Phrase } from '../api';
import { phraseSound } from '../lib/phrases';
import { CloseIcon, EditIcon } from './Icons';
import { SpeakButton } from './SpeakButton';

/**
 * One saved phrase as a block: the phrase, its reading and pronunciation, and its meaning, then its
 * buttons. Side by side on wide screens, stacked on phones.
 */
export function PhraseCard({
  phrase: p,
  onEdit,
  onDelete,
  selected,
  onToggle,
}: {
  phrase: Phrase;
  onEdit?: () => void;
  onDelete: () => void;
  /** In 선택 mode: whether it is ticked. The whole block toggles it and the buttons step aside. */
  selected?: boolean;
  onToggle?: () => void;
}) {
  if (onToggle) {
    return (
      <li className={`phrase-block phrase-block--select${selected ? ' is-selected' : ''}`}>
        <label className="phrase-block-pick">
          <input type="checkbox" checked={!!selected} onChange={onToggle} />
          <span className="phrase-block-main">
            <span lang="ja" className="phrase-block-term">
              {p.japanese}
            </span>
            <span className="phrase-block-meaning">{p.meaning}</span>
          </span>
        </label>
      </li>
    );
  }
  return (
    <li className="phrase-block">
      <div className="phrase-block-main">
        <span lang="ja" className="phrase-block-term">
          {p.japanese}
        </span>
        <span className="phrase-block-reading">
          {p.reading !== p.japanese && <span lang="ja">{p.reading}</span>}
          <span className="muted">{phraseSound(p)}</span>
        </span>
        <span className="phrase-block-meaning">{p.meaning}</span>
      </div>
      <span className="phrase-block-actions">
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
    </li>
  );
}
