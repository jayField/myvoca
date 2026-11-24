import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, type Grade } from '../api';
import { useAuth } from '../auth';
import { Flashcard } from '../components/Flashcard';
import { BackIcon } from '../components/Icons';
import { GRADES } from '../labels';
import { DAILY_DAYS, dailyLabel, dayTest, markDayPassed, parseDay, testScore } from '../lib/daily';
import { shuffle } from '../lib/random';

/**
 * A day's test, the same way as 오늘의 학습: flip the card, then 몰랐음 / 헷갈림 / 알았음. Only 알았음 on every
 * card is 100점, which passes the day; anything less offers the same words again, in a new order, until it is.
 * Grades count as quiz grades, so a missed word joins 헷갈리는 단어 without using up today's study goal.
 */
export default function DailyTest() {
  const day = parseDay(useParams().day);
  if (day === null) return <Navigate to="/daily" replace />;
  return <Test key={day} day={day} />;
}

type Card = ReturnType<typeof dayTest>[number];
const NO_COUNTS: Record<Grade, number> = { good: 0, hard: 0, again: 0 };

function Test({ day }: { day: number }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Card[]>(() => dayTest(day));
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [missed, setMissed] = useState<Card[]>([]);
  const current = queue[index];
  const perfect = !current && counts.good === queue.length;

  useEffect(() => {
    if (perfect) void markDayPassed(user?.id, day);
  }, [perfect, day, user?.id]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || !flipped || saving) return;
      setSaving(true);
      try {
        await api.review(current.item.id, g, 'quiz');
        setCounts((c) => ({ ...c, [g]: c[g] + 1 }));
        if (g !== 'good') setMissed((m) => [...m, current]);
        setIndex((i) => i + 1);
        setFlipped(false);
        setError(null);
      } catch {
        setError('저장하지 못했어요. 다시 눌러 주세요.');
      } finally {
        setSaving(false);
      }
    },
    [current, flipped, saving],
  );

  function retry() {
    setQueue((q) => shuffle(q));
    setRound((r) => r + 1);
    setIndex(0);
    setFlipped(false);
    setCounts(NO_COUNTS);
    setMissed([]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      const match = GRADES.find((g) => g.key === e.key);
      if (match) void grade(match.grade);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grade]);

  // Today's and earlier words come mixed, so each count adds up the cards of its kind already graded.
  const own = queue.filter((c) => !c.earlier).length;
  const earlier = queue.length - own;
  const ownDone = queue.slice(0, index).filter((c) => !c.earlier).length;
  const earlierDone = index - ownDone;
  const score = testScore(counts.good, queue.length);

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <Link to={`/daily/${day}`} className="back-link">
          <BackIcon />
          {day}일차
        </Link>
        {current && (
          <span className="study-counts small">
            {round > 1 && <span className="muted">{round}번째 도전</span>}
            <span className={current.earlier ? 'muted' : 'strong'}>
              {day}일차 {ownDone} / {own}
            </span>
            {earlier > 0 && (
              <span className={current.earlier ? 'strong' : 'muted'}>
                전 날 {earlierDone} / {earlier}
              </span>
            )}
          </span>
        )}
      </header>

      {error && <p className="banner-error">{error}</p>}

      {!current && perfect && (
        <div className="empty">
          <p className="daily-score daily-score--pass">100점</p>
          <h1>{day}일차 통과!</h1>
          <p className="muted">
            {queue.length}개 모두 알았어요{round > 1 ? ` · ${round}번 만에 통과` : ''}. 하루 단어 목록에 {day}일차가 색칠됐어요.
          </p>
          <div className="button-row">
            {day < DAILY_DAYS && (
              <Link to={`/daily/${day + 1}`} className="btn btn--primary">
                {day + 1}일차로
              </Link>
            )}
            <Link to="/daily" className="btn btn--ghost">
              목록 보기
            </Link>
          </div>
        </div>
      )}

      {!current && !perfect && (
        <div className="empty">
          <p className="daily-score">{score}점</p>
          <h1>100점이 될 때까지 다시!</h1>
          <p className="muted">
            {queue.length}개 중 알았음 {counts.good} · 헷갈림 {counts.hard} · 몰랐음 {counts.again}. 모두 알았음이어야 {day}일차가
            통과돼요.
          </p>
          <ul className="daily-missed">
            {missed.map((c) => (
              <li key={c.item.id}>
                <span lang="ja">{dailyLabel(c.item)}</span>
                <span className="muted">{c.item.meaning}</span>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={retry}>
              다시 하기
            </button>
            <Link to={`/daily/${day}`} className="btn btn--ghost">
              단어 다시 보기
            </Link>
          </div>
        </div>
      )}

      {current && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          <Flashcard
            key={`${round}-${current.item.id}-${index}`}
            item={current.item}
            tag={current.earlier ? '전 날 단어' : `${day}일차`}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
          {flipped ? (
            <div className="grade-row">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  type="button"
                  className={`btn grade-btn grade-btn--${g.grade}`}
                  disabled={saving}
                  onClick={() => void grade(g.grade)}
                >
                  {g.label}
                  <kbd className="kbd">{g.key}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small center">카드를 눌러 뒤집은 뒤, 아래 버튼으로 얼마나 알았는지 골라요.</p>
          )}
        </>
      )}
    </div>
  );
}
