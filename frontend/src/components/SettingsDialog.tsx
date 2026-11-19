import { useEffect, useRef, useState } from 'react';
import { api, type Deck, type OrderMode, type Settings } from '../api';
import { ORDER_LABEL } from '../labels';

const PRESETS = [5, 10, 20];

type ReviewMode = 'five' | 'all' | 'off';
const REVIEW_MODES: ReviewMode[] = ['five', 'all', 'off'];
const REVIEW_LABEL: Record<ReviewMode, string> = { five: '5개', all: '전부', off: '빼기' };
function reviewHint(mode: ReviewMode, daily: number): string {
  if (mode === 'off') return '새 항목만 보여줘요. 다시 켜면 헷갈리는 단어가 복습으로 나와요.';
  const count = mode === 'all' ? `하루 개수만큼(${daily}개)` : '5개';
  return `새 항목 전에 이 학습 범위의 헷갈리는 단어에서 랜덤으로 ${count}를 먼저 보여줘요.`;
}

function reviewMode(s: Settings): ReviewMode {
  return !s.include_reviews ? 'off' : s.all_reviews ? 'all' : 'five';
}

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
  // What is typed in the count box, kept apart from draft so it can be empty while retyping.
  const [dailyText, setDailyText] = useState(String(settings.daily_new));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDraft(settings);
      setDailyText(String(settings.daily_new));
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
                  onChange={() => {
                    setDraft({ ...draft, daily_new: n });
                    setDailyText(String(n));
                  }}
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
                value={dailyText}
                onChange={(e) => {
                  const text = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setDailyText(text);
                  const n = Number(text);
                  if (n >= 1) setDraft({ ...draft, daily_new: Math.min(100, n) });
                }}
                onBlur={() => setDailyText(String(draft.daily_new))}
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

        <fieldset className="field">
          <legend>복습</legend>
          <div className="choice-row">
            {REVIEW_MODES.map((mode) => (
              <label key={mode} className="chip">
                <input
                  type="radio"
                  name="reviews"
                  checked={reviewMode(draft) === mode}
                  onChange={() => setDraft({ ...draft, include_reviews: mode !== 'off', all_reviews: mode === 'all' })}
                />
                <span>{REVIEW_LABEL[mode]}</span>
              </label>
            ))}
          </div>
          <p className="hint">{reviewHint(reviewMode(draft), draft.daily_new)}</p>
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
