import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LOAD_ERROR, type Grade, type Item } from '../api';
import { Flashcard } from '../components/Flashcard';
import { BackIcon } from '../components/Icons';
import { GRADES } from '../labels';
import { shuffle } from '../lib/random';

type Kind = 'review' | 'new' | 'again';
const TAG: Record<Kind, string> = { review: '복습', new: '새 단어', again: '다시' };

interface Card {
  item: Item;
  kind: Kind;
}

export default function Study() {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Record<Grade, number> | null>(null);

  useEffect(() => {
    api
      .today()
      .then((plan) =>
        setQueue([
          // Reviews first, then new words, each in a fresh order every session.
          ...shuffle(plan.reviews).map((item) => ({ item, kind: 'review' as const })),
          ...shuffle(plan.new_items).map((item) => ({ item, kind: 'new' as const })),
        ]),
      )
      .catch(() => setError(LOAD_ERROR));
  }, []);

  const current = queue?.[index];
  const done = queue !== null && queue.length > 0 && !current;

  useEffect(() => {
    if (done) api.todayResults().then(setTotals).catch(() => setTotals(null));
  }, [done]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || !flipped || saving) return;
      setSaving(true);
      try {
        await api.review(current.item.id, g, 'study');
        // Missed cards come back at the end of today's session.
        if (g === 'again') setQueue((q) => q && [...q, { item: current.item, kind: 'again' }]);
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
      // A focused button already flips or grades on Space/Enter by itself.
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

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <Link to="/" className="back-link">
          <BackIcon />홈
        </Link>
        {queue && current && (
          <span className="muted small">
            {index + 1} / {queue.length}
          </span>
        )}
      </header>

      {error && <p className="banner-error">{error}</p>}

      {queue && queue.length === 0 && (
        <div className="empty">
          <h1>오늘 할 학습이 없어요</h1>
          <p className="muted">복습할 카드도, 새 항목도 남아 있지 않아요. 홈에서 범위나 개수를 바꿀 수 있어요.</p>
          <Link to="/" className="btn btn--primary">
            홈으로
          </Link>
        </div>
      )}

      {queue && queue.length > 0 && !current && (
        <div className="empty">
          <h1>오늘 학습 완료</h1>
          <p className="muted">
            {totals
              ? `오늘 전체 ${totals.good + totals.hard + totals.again}장 · 알았음 ${totals.good} · 헷갈림 ${totals.hard} · 몰랐음 ${totals.again}`
              : ''}
          </p>
          <div className="button-row">
            <Link to="/quiz" className="btn btn--primary">
              퀴즈로 확인하기
            </Link>
            <Link to="/" className="btn btn--ghost">
              홈으로
            </Link>
          </div>
        </div>
      )}

      {current && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(index / queue!.length) * 100}%` }} />
          </div>
          <Flashcard
            key={`${current.item.id}-${index}`}
            item={current.item}
            tag={TAG[current.kind]}
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
