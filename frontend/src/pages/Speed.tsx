import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck, type Item, type QuizQuestion } from '../api';
import { BackIcon } from '../components/Icons';
import { clampQuestionCount, QuestionCountPicker } from '../components/QuestionCountPicker';
import { showsReading, Term } from '../components/Term';

const TIME_LIMIT_MS = 5000;
const FEEDBACK_MS = 900;
const BEST_KEY = 'tango-note.speed.best';

interface Result {
  item: Item;
  correct: boolean;
  ms: number;
}

/** 100 points for a right answer plus up to 100 more for answering quickly. */
function points(r: Result): number {
  return r.correct ? 100 + Math.round((100 * (TIME_LIMIT_MS - r.ms)) / TIME_LIMIT_MS) : 0;
}

/** Best scores are kept per range and question count, since longer runs score higher. */
function loadBest(recordKey: string): number {
  try {
    return Number(localStorage.getItem(`${BEST_KEY}.${recordKey}`)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(recordKey: string, score: number) {
  try {
    localStorage.setItem(`${BEST_KEY}.${recordKey}`, String(score));
  } catch {
    // Best score is a nicety; ignore storage failures.
  }
}

export default function Speed() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [params] = useSearchParams();
  const [deckId, setDeckId] = useState(params.get('deck') ?? '');
  const [count, setCount] = useState(() => {
    const requested = Number(params.get('count'));
    return requested > 0 ? clampQuestionCount(requested) : 10;
  });
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(TIME_LIMIT_MS);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  // The timer and a click can land in the same instant; only the first one counts.
  const answeredIndex = useRef(-1);

  useEffect(() => {
    Promise.all([api.decks(), api.settings()])
      .then(([d, s]) => {
        setDecks(d.decks);
        setDeckId((current) => current || s.deck_id);
      })
      .catch(() => setError(LOAD_ERROR));
  }, []);

  const question = questions?.[index];
  const answered = results.length > index;
  const finished = questions !== null && index >= questions.length;

  const answer = useCallback(
    (choice: number | null) => {
      if (!question || answered || answeredIndex.current === index) return;
      answeredIndex.current = index;
      const ms = Math.min(TIME_LIMIT_MS, performance.now() - startedAt.current);
      setPicked(choice);
      setResults((r) => [...r, { item: question.item, correct: choice !== null && question.choices[choice].id === question.item.id, ms }]);
    },
    [question, answered, index],
  );

  // Countdown for the current question; running out counts as a miss.
  useEffect(() => {
    if (!question || answered) return;
    startedAt.current = performance.now();
    setRemaining(TIME_LIMIT_MS);
    const timer = window.setInterval(() => {
      const left = TIME_LIMIT_MS - (performance.now() - startedAt.current);
      if (left <= 0) answer(null);
      setRemaining(Math.max(0, left));
    }, 50);
    return () => window.clearInterval(timer);
  }, [question, answered, answer]);

  // After a short look at the right answer, move on by itself.
  useEffect(() => {
    if (!answered) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setPicked(null);
    }, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [answered]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) answer(n - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  const score = results.reduce((sum, r) => sum + points(r), 0);
  const recordKey = `${deckId}.${count}`;

  useEffect(() => {
    if (!finished) return;
    const previous = loadBest(recordKey);
    if (score > previous) {
      saveBest(recordKey, score);
      setNewBest(previous > 0);
      setBest(score);
    } else {
      setBest(previous);
    }
  }, [finished, recordKey, score]);

  async function start() {
    try {
      const quiz = await api.quiz(deckId, count);
      setQuestions(quiz.questions);
      answeredIndex.current = -1;
      setIndex(0);
      setResults([]);
      setPicked(null);
      setNewBest(false);
      setReviewSaved(false);
      setBest(loadBest(recordKey));
      setError(null);
    } catch {
      setError(LOAD_ERROR);
    }
  }

  async function addMissesToReview() {
    try {
      for (const r of results.filter((x) => !x.correct)) await api.review(r.item.id, 'again', 'quiz');
      setReviewSaved(true);
    } catch {
      setError('복습 목록에 넣지 못했어요. 다시 시도해 주세요.');
    }
  }

  if (!questions) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div>
            <Link to="/quiz" className="back-link">
              <BackIcon />
              퀴즈
            </Link>
            <h1>5초 스피드</h1>
            <p className="muted small">단어가 나오면 5초 안에 뜻을 골라요. 빨리 맞힐수록 점수가 높아요.</p>
          </div>
        </header>
        {error && <p className="banner-error">{error}</p>}
        <div className="card card--lg stack">
          <fieldset className="field">
            <legend>범위</legend>
            <div className="choice-row">
              {[...decks.map((d) => ({ id: d.id, title: d.title })), { id: CONFUSING_DECK_ID, title: '헷갈리는 단어' }].map((d) => (
                <label key={d.id} className="chip">
                  <input type="radio" name="deck" checked={deckId === d.id} onChange={() => setDeckId(d.id)} />
                  <span>{d.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <QuestionCountPicker value={count} onChange={setCount} />
          {deckId && loadBest(recordKey) > 0 && (
            <p className="muted small">
              이 범위 {count}문제 최고 기록 {loadBest(recordKey)}점
            </p>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void start()} disabled={!deckId}>
            {count}문제 시작
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="page page--narrow">
        <div className="empty">
          <h1>낼 문제가 없어요</h1>
          <p className="muted">헷갈리는 단어가 아직 없어요. 다른 범위를 골라 보세요.</p>
          <button type="button" className="btn btn--primary" onClick={() => setQuestions(null)}>
            범위 다시 고르기
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const correct = results.filter((r) => r.correct);
    const misses = results.filter((r) => !r.correct);
    const avg = correct.length ? (correct.reduce((s, r) => s + r.ms, 0) / correct.length / 1000).toFixed(1) : '-';
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <h1>{score}점</h1>
          {newBest && <span className="badge badge--mastered">최고 기록!</span>}
        </header>
        <div className="tile-grid">
          <div className="card tile">
            <span className="muted small">정답</span>
            <span className="tile-value">
              {correct.length} / {results.length}
            </span>
          </div>
          <div className="card tile">
            <span className="muted small">평균 답 시간</span>
            <span className="tile-value">{avg}초</span>
          </div>
          <div className="card tile">
            <span className="muted small">최고 기록</span>
            <span className="tile-value">{best}점</span>
          </div>
        </div>
        {error && <p className="banner-error">{error}</p>}
        {misses.length > 0 && (
          <section className="stack-sm" aria-labelledby="misses">
            <h2 id="misses" className="section-title">
              놓친 단어
            </h2>
            <ul className="item-list">
              {misses.map((r, i) => (
                <li key={`${r.item.id}-${i}`} className="item-row">
                  <Term item={r.item} className="item-term" />
                  <span className="item-text">
                    {r.item.kind === 'word' && showsReading(r.item) && <span lang="ja">{r.item.reading}</span>}
                    <span className="muted">{r.item.meaning}</span>
                  </span>
                  <span className="muted small">{r.ms >= TIME_LIMIT_MS ? '시간 초과' : '오답'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="button-row">
          <button type="button" className="btn btn--primary" onClick={() => void start()}>
            다시 하기
          </button>
          {misses.length > 0 &&
            (reviewSaved ? (
              <span className="success-text small">놓친 단어를 복습 목록에 넣었어요.</span>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => void addMissesToReview()}>
                놓친 {misses.length}개 복습에 넣기
              </button>
            ))}
          <Link to="/" className="btn btn--ghost">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  const q = question!;
  const fraction = remaining / TIME_LIMIT_MS;
  const last = results[index];

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <button type="button" className="back-link back-link--btn" onClick={() => setQuestions(null)}>
          그만하기
        </button>
        <span className="muted small">
          {index + 1} / {questions.length} · {score}점
        </span>
      </header>

      <div
        className={fraction < 0.3 && !answered ? 'speed-timer speed-timer--low' : 'speed-timer'}
        role="progressbar"
        aria-label="남은 시간"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={Math.ceil(remaining / 1000)}
      >
        <div className="speed-timer-fill" style={{ width: `${fraction * 100}%` }} />
      </div>

      <div className="card card--lg quiz-question">
        <Term item={q.item} className="quiz-term" />
        <p className={answered ? (last.correct ? 'success-text' : 'danger-text') : 'muted small'} aria-live="polite">
          {answered
            ? last.correct
              ? `정답 +${points(last)}`
              : last.ms >= TIME_LIMIT_MS
                ? `시간 초과 · ${q.item.meaning}`
                : `아쉬워요 · ${q.item.meaning}`
            : `${Math.ceil(remaining / 1000)}초`}
        </p>
      </div>

      <div className="choice-grid">
        {q.choices.map((c, i) => {
          const state = !answered ? '' : c.id === q.item.id ? ' choice--correct' : picked === i ? ' choice--wrong' : '';
          return (
            <button key={c.id} type="button" className={`choice${state}`} disabled={answered} onClick={() => answer(i)}>
              {c.meaning}
            </button>
          );
        })}
      </div>
    </div>
  );
}
