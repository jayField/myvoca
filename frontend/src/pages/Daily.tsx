import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { DAILY_DAYS, DAILY_SIZE, dayLevel, dayWords, dailyLabel, loadPassedDays, localPassedDays } from '../lib/daily';

/** 하루 단어: every day as a tile, grouped by JLPT level, with the next unfinished day up top. */
export default function Daily() {
  const { user } = useAuth();
  // This device's copy first, then the account's, so a day passed on another device is colored in too.
  const [done, setDone] = useState(() => localPassedDays(user?.id));
  useEffect(() => {
    let live = true;
    loadPassedDays(user?.id).then((days) => live && setDone(days)).catch(() => {});
    return () => {
      live = false;
    };
  }, [user?.id]);
  const days = Array.from({ length: DAILY_DAYS }, (_, i) => i + 1);
  const next = days.find((d) => !done.has(d)) ?? 1;
  const levels = [...new Set(days.map(dayLevel))];

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>하루 단어</h1>
          <p className="muted small">
            하루 {DAILY_SIZE}개씩, 일상 기초 단어(N5)부터 차근차근. 테스트는 그날 단어 전부에 앞 날짜 단어 10개가 섞여 나오고, 100점을 받으면 그날이 색칠돼요.
          </p>
        </div>
      </header>

      <Link to={`/daily/${next}`} className="card daily-next">
        <span>
          <span className="muted small">{done.size ? `이어서 하기 · ${done.size}일 통과` : '시작하기'}</span>
          <strong className="daily-next-day">{next}일차</strong>
        </span>
        <span lang="ja" className="muted small daily-next-preview">
          {dayWords(next)
            .slice(0, 3)
            .map((w) => dailyLabel(w))
            .join(' · ')}{' '}
          …
        </span>
      </Link>

      {levels.map((level) => (
        <section key={level} aria-labelledby={`daily-${level}`}>
          <h2 id={`daily-${level}`} className="section-title">
            JLPT {level}
          </h2>
          <ul className="daily-grid">
            {days
              .filter((d) => dayLevel(d) === level)
              .map((d) => (
                <li key={d}>
                  <Link
                    to={`/daily/${d}`}
                    className={['daily-tile', done.has(d) && 'is-done', d === next && 'is-next'].filter(Boolean).join(' ')}
                    aria-label={`${d}일차${done.has(d) ? ', 통과' : ''}`}
                  >
                    {d}일차
                    {done.has(d) && <span aria-hidden="true">✓</span>}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
