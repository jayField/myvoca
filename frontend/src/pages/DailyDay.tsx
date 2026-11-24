import { Link, Navigate, useParams } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { DAILY_DAYS, DAILY_REVIEW, dayLevel, dayWords, dailyLabel, parseDay } from '../lib/daily';
import { toHangul } from '../lib/kana';

/** One day of 하루 단어: its ten words as ひらがな(漢字), meaning, Hangul sound and voice, with the test on top. */
export default function DailyDay() {
  const day = parseDay(useParams().day);
  if (day === null) return <Navigate to="/daily" replace />;
  const words = dayWords(day);

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <Link to="/daily" className="back-link">
          <BackIcon />
          하루 단어
        </Link>
      </header>

      <div className="daily-day-head">
        <div>
          <h1>{day}일차</h1>
          <p className="muted small">
            JLPT {dayLevel(day)} · 단어 {words.length}개
            {day === 1
              ? ' · 테스트 10문제'
              : ` · 테스트 ${words.length + DAILY_REVIEW}문제 (오늘 단어 전부 + ${day === 2 ? '1일차 단어 전부' : `앞 단어 ${DAILY_REVIEW}개, 밀린 날 먼저 · 매일 바뀜`})`}
          </p>
        </div>
        <Link to={`/daily/${day}/test`} className="btn btn--primary">
          테스트 보기
        </Link>
      </div>

      <ol className="daily-words">
        {words.map((w, i) => (
          <li key={w.id} className="card daily-word">
            <span className="daily-word-no muted small">{i + 1}</span>
            <span className="daily-word-main">
              <span lang="ja" className="daily-word-ja">
                {dailyLabel(w)}
              </span>
              <span className="daily-word-meaning">{w.meaning}</span>
              <span className="muted small">발음 {toHangul(w.reading)}</span>
            </span>
            <SpeakButton text={w.term} />
          </li>
        ))}
      </ol>

      <div className="button-row daily-day-nav">
        {day > 1 && (
          <Link to={`/daily/${day - 1}`} className="btn btn--ghost">
            ← {day - 1}일차
          </Link>
        )}
        {day < DAILY_DAYS && (
          <Link to={`/daily/${day + 1}`} className="btn btn--ghost">
            {day + 1}일차 →
          </Link>
        )}
      </div>
    </div>
  );
}
