import { useEffect, useRef, useState } from 'react';
import { api, type Deck, type OrderMode, type Settings } from '../api';
import { ORDER_LABEL } from '../labels';

const PRESETS = [5, 10, 20];

interface Props {
  open: boolean;
  decks: Deck[];
  settings: Settings;
  onClose: () => void;
  onSaved: (settings: Settings) => void;
}

export function SettingsDialog({ open, decks, settings, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDraft(settings);
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, settings]);

  async function save() {
    setSaving(true);
    try {
      onSaved(await api.saveSettings(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="settings-title">
      <form
        method="dialog"
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 id="settings-title">오늘의 학습 설정</h2>

        <fieldset className="field">
          <legend>학습 범위</legend>
          <div className="choice-row">
            {decks.map((deck) => (
              <label key={deck.id} className="chip">
                <input
                  type="radio"
                  name="deck"
                  checked={draft.deck_id === deck.id}
                  onChange={() => setDraft({ ...draft, deck_id: deck.id })}
                />
                <span>{deck.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>하루 새 항목 개수</legend>
          <div className="choice-row">
            {PRESETS.map((n) => (
              <label key={n} className="chip">
                <input
                  type="radio"
                  name="daily"
                  checked={draft.daily_new === n}
                  onChange={() => setDraft({ ...draft, daily_new: n })}
                />
                <span>{n}개</span>
              </label>
            ))}
            <label className="number-input">
              <span className="sr-only">직접 입력</span>
              <input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={draft.daily_new}
                onChange={(e) => setDraft({ ...draft, daily_new: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
              />
              <span aria-hidden="true">개</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>새 항목 선택 방식</legend>
          <div className="choice-row">
            {(Object.keys(ORDER_LABEL) as OrderMode[]).map((mode) => (
              <label key={mode} className="chip">
                <input
                  type="radio"
                  name="order"
                  checked={draft.order === mode}
                  onChange={() => setDraft({ ...draft, order: mode })}
                />
                <span>{ORDER_LABEL[mode]}</span>
              </label>
            ))}
          </div>
          <p className="hint">
            {draft.order === 'sequential' ? '목록 순서대로 다음 묶음을 가져와요.' : '아직 안 배운 항목 중에서 무작위로 골라요.'} 한 번
            배운 항목은 새 항목으로 다시 나오지 않아요.
          </p>
        </fieldset>

        {error && <p className="error-text">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
