import { useState } from 'react';
import { autoSound } from '../lib/phrases';
import { formatTime, parseTime, type SongLine } from '../lib/songs';

type Field = 'japanese' | 'reading' | 'sound' | 'meaning';

const FIELDS: { key: Field; label: string; ja?: boolean; max: number }[] = [
  { key: 'japanese', label: '일본어', ja: true, max: 200 },
  { key: 'reading', label: '읽기 (히라가나)', ja: true, max: 300 },
  { key: 'sound', label: '한글 발음', max: 300 },
  { key: 'meaning', label: '뜻', max: 200 },
];

/**
 * Edit one lyric line in place: when it starts, the line, its reading, its Hangul pronunciation and its
 * meaning. 지금 sets the start to where the video is, for fixing timing by ear.
 */
export function LyricEditor({
  line,
  now,
  onSave,
  onDelete,
  onCancel,
}: {
  line: SongLine;
  /** Where the video is, on the lyrics' own clock (sync offset taken out); null before it is ready. */
  now: () => number | null;
  onSave: (line: SongLine) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Record<Field, string>>(() => ({
    japanese: line.japanese,
    reading: line.reading,
    sound: line.sound ?? '',
    meaning: line.meaning,
  }));
  const [time, setTime] = useState(formatTime(line.t));
  // The pronunciation follows the reading until it is typed in (or already was).
  const [typed, setTyped] = useState(!!line.sound);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Record<Field, string>;
  // The word split belongs to the old wording; it goes once the line itself changes.
  const words = trimmed.japanese === line.japanese && trimmed.reading === line.reading ? line.words : [];
  const auto = autoSound({ reading: trimmed.reading, words });
  const t = parseTime(time);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed.japanese || !trimmed.reading) return setError('일본어와 읽기를 적어 주세요.');
    if (t === null) return setError('시간은 1:23.45처럼 적어 주세요.');
    // Stored only when it differs from the automatic one, so a later reading fix still updates it.
    const sound = typed && trimmed.sound !== auto ? trimmed.sound : '';
    void run(() => onSave({ t, japanese: trimmed.japanese, reading: trimmed.reading, meaning: trimmed.meaning, words, ...(sound && { sound }) }));
  }

  return (
    <form className="phrase-editor lyric-editor" onSubmit={save}>
      <div className="lyric-editor-time">
        <label className="talk-field">
          <span>시작 시간</span>
          <input
            className={`text-input lyric-time-input${t === null ? ' is-invalid' : ''}`}
            inputMode="decimal"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          title="영상이 지금 있는 곳을 이 줄의 시작으로"
          onClick={() => {
            const at = now();
            if (at !== null) setTime(formatTime(Math.max(0, at)));
          }}
        >
          지금
        </button>
      </div>
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
        <button
          type="button"
          className="btn btn--ghost btn--sm lyric-delete"
          disabled={saving}
          onClick={() => window.confirm('이 줄을 지울까요?') && void run(onDelete)}
        >
          줄 삭제
        </button>
      </div>
    </form>
  );
}
