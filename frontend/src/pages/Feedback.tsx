import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import {
  addFeedback,
  CATEGORY_LABEL,
  deleteFeedback,
  listFeedback,
  MAX_FEEDBACK_LENGTH,
  type FeedbackCategory,
  type FeedbackNote,
} from '../lib/feedback';

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Feedback() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<FeedbackNote[] | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listFeedback()
      .then((list) => {
        setNotes(list);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '피드백을 불러오지 못했어요.'));
  }, []);

  useEffect(load, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addFeedback(category, body);
      setBody('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '남기지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('이 피드백을 지울까요?')) return;
    try {
      await deleteFeedback(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '지우지 못했어요.');
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>피드백</h1>
          <p className="muted small">"이런 기능이 있으면 좋겠다", "여기가 불편하다" 같은 의견을 자유롭게 남겨 주세요.</p>
        </div>
      </header>

      <form className="card card--lg stack-sm" onSubmit={submit}>
        <div className="choice-row" role="radiogroup" aria-label="종류">
          {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((c) => (
            <label key={c} className="chip">
              <input type="radio" name="category" checked={category === c} onChange={() => setCategory(c)} />
              <span>{CATEGORY_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <label className="form-field">
          <span className="sr-only">내용</span>
          <textarea
            className="text-input text-input--block feedback-input"
            rows={4}
            maxLength={MAX_FEEDBACK_LENGTH}
            placeholder="예) 퀴즈 결과를 날짜별로 볼 수 있으면 좋겠어요."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="button-row feedback-actions">
          <span className="muted xsmall">
            {body.length} / {MAX_FEEDBACK_LENGTH}
          </span>
          <button type="submit" className="btn btn--primary" disabled={busy || !body.trim()}>
            {busy ? '남기는 중…' : '남기기'}
          </button>
        </div>
      </form>

      {error && <p className="banner-error">{error}</p>}

      {notes && notes.length === 0 && <p className="muted">아직 남겨진 피드백이 없어요. 첫 번째로 남겨 보세요.</p>}

      {notes && notes.length > 0 && (
        <ul className="feedback-list">
          {notes.map((n) => (
            <li key={n.id} className="card feedback-note">
              <div className="feedback-meta">
                <span className={`badge feedback-badge--${n.category}`}>{CATEGORY_LABEL[n.category]}</span>
                <span className="small">{n.author}</span>
                <span className="muted xsmall">{when(n.created_at)}</span>
                {user?.id === n.user_id && (
                  <button type="button" className="feedback-delete" onClick={() => void remove(n.id)}>
                    지우기
                  </button>
                )}
              </div>
              <p className="feedback-body">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
