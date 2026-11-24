import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, type Grade } from '../api';
import { useAuth } from '../auth';
import { Flashcard } from '../components/Flashcard';
import { BackIcon } from '../components/Icons';
import { GRADES } from '../labels';
import { DAILY_DAYS, dayTest, markDayDone, parseDay } from '../lib/daily';

/**
 * A day's test, the same way as 오늘의 학습: flip the card, then 몰랐음 / 헷갈림 / 알았음. Grades count as quiz
 * grades, so a missed word joins 헷갈리는 단어 without using up today's study goal.
 */
export default function DailyTest() {
  const day = parseDay(useParams().day);
  if (day === null) return <Navigate to="/daily" replace />;
  return <Test key={day} day={day} />;
}

function Test({ day }: { day: number }) {
  const { user } = useAuth();
  const queue = useMemo(() => dayTest(day), [day]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<Grade, number>>({ good: 0, hard: 0, again: 0 });
  const current = queue[index];

  useEffect(() => {
    if (!current) markDayDone(user?.id, day);
  }, [current, day, user?.id]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || !flipped || saving) return;
      setSaving(true);
      try {
        await api.review(current.item.id, g, 'quiz');
        setCounts((c) => ({ ...c, [g]: c[g] + 1 }));
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

  const own = queue.filter((c) => !c.earlier).length;
  const earlier = queue.length - own;

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <Link to={`/daily/${day}`} className="back-link">
          <BackIcon />
          {day}일차
        </Link>
        {current && (
          <span className="study-counts small">
            <span className={current.earlier ? 'muted' : 'strong'}>
              {day}일차 {Math.min(index, own)} / {own}
            </span>
            {earlier > 0 && (
              <span className={current.earlier ? 'strong' : 'muted'}>
                전 날 {Math.max(0, index - own)} / {earlier}
              </span>
            )}
          </span>
        )}
      </header>

      {error && <p className="banner-error">{error}</p>}

      {!current ? (
        <div className="empty">
          <h1>{day}일차 테스트 완료</h1>
          <p className="muted">
            {queue.length}개 중 알았음 {counts.good} · 헷갈림 {counts.hard} · 몰랐음 {counts.again}
            {counts.hard + counts.again > 0 && <><br />헷갈린 단어는 헷갈리는 단어장에 모아 뒀어요.</>}
          </p>
          <div className="button-row">
            {day < DAILY_DAYS && (
              <Link to={`/daily/${day + 1}`} className="btn btn--primary">
                {day + 1}일차로
              </Link>
            )}
            <Link to={`/daily/${day}`} className="btn btn--ghost">
              단어 다시 보기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          <Flashcard
            key={`${current.item.id}-${index}`}
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
