import { useState } from 'react';
import type { Phrase } from '../api';
import { toHangul } from '../lib/kana';
import { autoSound, updatePhrase } from '../lib/phrases';

type Field = 'japanese' | 'reading' | 'sound' | 'meaning' | 'note' | 'example_ja' | 'example_reading' | 'example_sound' | 'example_ko';
type SoundField = 'sound' | 'example_sound';

const FIELDS: { key: Field; label: string; ja?: boolean; long?: boolean; required?: boolean; max: number }[] = [
  { key: 'japanese', label: '일본어', ja: true, required: true, max: 200 },
  { key: 'reading', label: '읽기 (히라가나)', ja: true, required: true, max: 300 },
  { key: 'sound', label: '한글 발음', max: 300 },
  { key: 'meaning', label: '뜻', long: true, required: true, max: 200 },
  { key: 'note', label: '메모', long: true, max: 500 },
  { key: 'example_ja', label: '예시', ja: true, long: true, max: 500 },
  { key: 'example_reading', label: '예시 읽기 (히라가나)', ja: true, long: true, max: 1000 },
  { key: 'example_sound', label: '예시 한글 발음', long: true, max: 1000 },
  { key: 'example_ko', label: '예시 뜻', long: true, max: 500 },
];

/** Edit a saved phrase in place: fix the translation and its Hangul pronunciation, add a memo, rewrite the example. */
export function PhraseEditor({ phrase, onSaved, onCancel }: { phrase: Phrase; onSaved: (p: Phrase) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const { japanese, reading, sound, meaning, note, example_ja, example_reading, example_sound, example_ko } = phrase;
    return { japanese, reading, sound, meaning, note, example_ja, example_reading, example_sound, example_ko };
  });
  // A pronunciation field follows its reading until the learner types in it (or already had their own).
  const [typed, setTyped] = useState<Record<SoundField, boolean>>({ sound: !!phrase.sound, example_sound: !!phrase.example_sound });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Record<Field, string>;
  // The word breakdown belongs to the old wording; it goes once the phrase itself changes.
  const sameWording = trimmed.japanese === phrase.japanese && trimmed.reading === phrase.reading;
  const words = sameWording ? phrase.words : [];
  // A new example with the old reading left in place would read wrong, so that reading goes too.
  const exampleReading =
    trimmed.example_ja !== phrase.example_ja && trimmed.example_reading === phrase.example_reading ? '' : trimmed.example_reading;
  const auto: Record<SoundField, string> = {
    sound: autoSound({ reading: trimmed.reading, words }),
    example_sound: toHangul(exampleReading),
  };
  const shown = (key: Field) => (key === 'sound' || key === 'example_sound') && !typed[key] ? auto[key] : form[key];
  /** What to store for a pronunciation: '' (automatic) unless the learner typed something different. */
  const stored = (key: SoundField) => (typed[key] && trimmed[key] !== auto[key] ? trimmed[key] : '');

  function change(key: Field, value: string) {
    if (key === 'sound' || key === 'example_sound') setTyped({ ...typed, [key]: true });
    setForm({ ...form, [key]: value });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = FIELDS.find((f) => f.required && !trimmed[f.key]);
    if (missing) return setError(`${missing.label.split(' ')[0]}을(를) 적어 주세요.`);
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await updatePhrase(phrase.id, {
          ...trimmed,
          example_reading: exampleReading,
          sound: stored('sound'),
          example_sound: stored('example_sound'),
          words,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="phrase-editor" onSubmit={(e) => void save(e)}>
      <div className="phrase-editor-grid">
        {FIELDS.map((f) => {
          const isSound = f.key === 'sound' || f.key === 'example_sound';
          const props = {
            lang: f.ja ? 'ja' : undefined,
            maxLength: f.max,
            value: shown(f.key),
            placeholder: isSound ? auto[f.key as SoundField] || '예) 키미오 오못테이루' : undefined,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(f.key, e.target.value),
          };
          return (
            <label key={f.key} className={`talk-field${f.long ? ' phrase-editor-wide' : ''}`}>
              <span>{f.label}</span>
              {f.long ? (
                <textarea className="text-input text-input--block text-area" rows={2} {...props} />
              ) : (
                <input className="text-input text-input--block" {...props} />
              )}
              {isSound && typed[f.key as SoundField] && (
                <span className="phrase-editor-hint">
                  직접 고친 발음이에요.{' '}
                  <button type="button" className="link-btn" onClick={() => setTyped({ ...typed, [f.key]: false })}>
                    자동 발음으로 되돌리기
                  </button>
                </span>
              )}
            </label>
          );
        })}
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
