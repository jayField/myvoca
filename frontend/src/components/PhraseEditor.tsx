import { useState } from 'react';
import type { Phrase } from '../api';
import { toHangul } from '../lib/kana';
import { updatePhrase, type PhraseEdit } from '../lib/phrases';

type Field = Exclude<keyof PhraseEdit, 'words'>;

const FIELDS: { key: Field; label: string; ja?: boolean; long?: boolean; required?: boolean; max: number }[] = [
  { key: 'japanese', label: '일본어', ja: true, required: true, max: 200 },
  { key: 'reading', label: '읽기 (히라가나)', ja: true, required: true, max: 300 },
  { key: 'meaning', label: '뜻', required: true, max: 200 },
  { key: 'note', label: '메모', long: true, max: 500 },
  { key: 'example_ja', label: '예시', ja: true, long: true, max: 500 },
  { key: 'example_reading', label: '예시 읽기 (히라가나, 띄어쓰기하면 발음도 띄어져요)', ja: true, long: true, max: 1000 },
  { key: 'example_ko', label: '예시 뜻', long: true, max: 500 },
];

/** Edit a saved phrase in place: fix the translation, add a memo, rewrite the example. */
export function PhraseEditor({ phrase, onSaved, onCancel }: { phrase: Phrase; onSaved: (p: Phrase) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const { japanese, reading, meaning, note, example_ja, example_reading, example_ko } = phrase;
    return { japanese, reading, meaning, note, example_ja, example_reading, example_ko };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Record<Field, string>;
    const missing = FIELDS.find((f) => f.required && !next[f.key]);
    if (missing) return setError(`${missing.label.split(' ')[0]}을(를) 적어 주세요.`);
    // The word breakdown belongs to the old wording; drop it once the phrase itself changes.
    const sameWording = next.japanese === phrase.japanese && next.reading === phrase.reading;
    // A new example with the old reading left in place would show the wrong pronunciation.
    if (next.example_ja !== phrase.example_ja && next.example_reading === phrase.example_reading) next.example_reading = '';
    setSaving(true);
    setError(null);
    try {
      onSaved(await updatePhrase(phrase.id, { ...next, words: sameWording ? phrase.words : [] }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="phrase-editor" onSubmit={(e) => void save(e)}>
      <div className="phrase-editor-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className={`talk-field${f.long ? ' phrase-editor-wide' : ''}`}>
            <span>{f.label}</span>
            {f.long ? (
              <textarea
                lang={f.ja ? 'ja' : undefined}
                className="text-input text-input--block text-area"
                rows={2}
                maxLength={f.max}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                lang={f.ja ? 'ja' : undefined}
                className="text-input text-input--block"
                maxLength={f.max}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
            {(f.key === 'reading' || f.key === 'example_reading') && form[f.key].trim() && (
              <span className="talk-example-sound">발음: {toHangul(form[f.key].trim())}</span>
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
