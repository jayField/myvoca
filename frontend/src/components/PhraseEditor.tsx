import { useState } from 'react';
import type { Phrase } from '../api';
import { autoSound, updatePhrase } from '../lib/phrases';

type Field = 'japanese' | 'reading' | 'sound' | 'meaning';

const FIELDS: { key: Field; label: string; ja?: boolean; max: number }[] = [
  { key: 'japanese', label: '일본어', ja: true, max: 200 },
  { key: 'reading', label: '읽기 (히라가나)', ja: true, max: 300 },
  { key: 'sound', label: '한글 발음', max: 300 },
  { key: 'meaning', label: '뜻', max: 200 },
];

/** Edit a saved phrase in place: the phrase, its reading, its Hangul pronunciation and its meaning. */
export function PhraseEditor({ phrase, onSaved, onCancel }: { phrase: Phrase; onSaved: (p: Phrase) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const { japanese, reading, sound, meaning } = phrase;
    return { japanese, reading, sound, meaning };
  });
  // The pronunciation follows the reading until the learner types in it (or already had their own).
  const [typed, setTyped] = useState(!!phrase.sound);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Record<Field, string>;
  // The word split belongs to the old wording; it goes once the phrase itself changes.
  const sameWording = trimmed.japanese === phrase.japanese && trimmed.reading === phrase.reading;
  const words = sameWording ? phrase.words : [];
  const auto = autoSound({ reading: trimmed.reading, words });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = FIELDS.find((f) => f.key !== 'sound' && !trimmed[f.key]);
    if (missing) return setError(`${missing.label.split(' ')[0]}을(를) 적어 주세요.`);
    setSaving(true);
    setError(null);
    try {
      // Stored only when it differs from the automatic one, so a later reading fix still updates it.
      const sound = typed && trimmed.sound !== auto ? trimmed.sound : '';
      onSaved(await updatePhrase(phrase.id, { ...trimmed, sound, words }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="phrase-editor" onSubmit={(e) => void save(e)}>
      <div className="phrase-editor-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="talk-field">
            <span>{f.label}</span>
            <input
              lang={f.ja ? 'ja' : undefined}
              className="text-input text-input--block"
              maxLength={f.max}
              placeholder={f.key === 'sound' ? auto : undefined}
              value={f.key === 'sound' && !typed ? auto : form[f.key]}
              onChange={(e) => {
                if (f.key === 'sound') setTyped(true);
                setForm({ ...form, [f.key]: e.target.value });
              }}
            />
            {f.key === 'sound' && typed && (
              <span className="phrase-editor-hint">
                직접 고친 발음이에요.{' '}
                <button type="button" className="link-btn" onClick={() => setTyped(false)}>
                  자동 발음으로 되돌리기
                </button>
              </span>
            )}
          </label>
        ))}
      </div>
      {error && <p className="banner-error">{error}</p>}
      <div className="button-row">
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>
          취소
        </button>
      </div>
    </form>
  );
}
