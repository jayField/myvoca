import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { DAILY_DAYS, DAILY_SIZE, dayLevel, dayWords, dailyLabel, loadDoneDays } from '../lib/daily';

/** 하루 단어: every day as a tile, grouped by JLPT level, with the next unfinished day up top. */
export default function Daily() {
  const { user } = useAuth();
  const done = loadDoneDays(user?.id);
  const days = Array.from({ length: DAILY_DAYS }, (_, i) => i + 1);
  const next = days.find((d) => !done.has(d)) ?? 1;
  const levels = [...new Set(days.map(dayLevel))];

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>하루 단어</h1>
          <p className="muted small">
            하루 {DAILY_SIZE}개씩, 일상 기초 단어(N5)부터 차근차근. 테스트는 1일차부터 그날까지의 단어에서 무작위로 20문제예요.
          </p>
        </div>
      </header>

      <Link to={`/daily/${next}`} className="card daily-next">
        <span>
          <span className="muted small">{done.size ? '이어서 하기' : '시작하기'}</span>
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
                    aria-label={`${d}일차${done.has(d) ? ', 테스트 완료' : ''}`}
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
