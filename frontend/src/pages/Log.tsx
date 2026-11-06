import { useCallback, useEffect, useState } from 'react';
import { useDataVersion } from '../auth';
import { api, LOAD_ERROR, type LogDay } from '../api';
import { SpeakButton } from '../components/SpeakButton';
import { Term } from '../components/Term';
import { GRADES } from '../labels';
import { dayLabel } from '../lib/dates';
import { toRomaji } from '../lib/kana';

const GRADE_LABEL = new Map(GRADES.map((g) => [g.grade, g.label]));
const KIND_LABEL = { new: '새 단어', review: '복습' };

interface LogMonth {
  month: string;
  days: LogDay[];
}

interface LogYear {
  year: string;
  months: LogMonth[];
}

/** Days arrive newest first, so years and months come out newest first too. */
function groupByMonth(days: LogDay[]): LogYear[] {
  const years: LogYear[] = [];
  for (const day of days) {
    const [year, month] = day.day.split('-');
    let y = years.at(-1);
    if (y?.year !== year) years.push((y = { year, months: [] }));
    let m = y.months.at(-1);
    if (m?.month !== month) y.months.push((m = { month, days: [] }));
    m.days.push(day);
  }
  return years;
}

const wordCount = (days: LogDay[]) => days.reduce((sum, d) => sum + d.entries.length, 0);

export default function Log() {
  const [days, setDays] = useState<LogDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .studyLog()
      .then(setDays)
      .catch(() => setError(LOAD_ERROR));
  }, []);

  const dataVersion = useDataVersion();
  useEffect(load, [load, dataVersion]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>복습표</h1>
          <p className="muted small">공부한 단어가 날짜별로 자동으로 저장돼요.</p>
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {days && days.length === 0 && <p className="muted">아직 공부한 단어가 없어요. 오늘의 학습을 시작해 보세요.</p>}

      {days &&
        groupByMonth(days).map(({ year, months }, y) => (
          // The newest month starts open so today's table is one look away; the rest open on a click.
          <details key={year} className="log-fold log-year" open={y === 0}>
            <summary>
              {year}년 <span className="muted small">· {wordCount(months.flatMap((m) => m.days))}개</span>
            </summary>
            <div className="log-months">
              {months.map(({ month, days: monthDays }, m) => (
                <details key={month} className="log-fold log-month" open={y === 0 && m === 0}>
                  <summary>
                    {Number(month)}월{' '}
                    <span className="muted small">
                      · {monthDays.length}일 · {wordCount(monthDays)}개
                    </span>
                  </summary>
                  <div className="log-days">
                    {monthDays.map((d) => (
                      <DayTable key={d.day} {...d} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
    </div>
  );
}

function DayTable({ day, entries }: LogDay) {
  return (
    <section aria-labelledby={`log-${day}`} className="stack-sm">
      <h2 id={`log-${day}`} className="section-title day-title">
        {dayLabel(day, true)} <span className="muted small">· {entries.length}개</span>
      </h2>
      <div className="log-scroll">
        <table className="log-table">
          <thead>
            <tr>
              <th scope="col">단어</th>
              <th scope="col">읽기</th>
              <th scope="col">발음</th>
              <th scope="col">뜻</th>
              <th scope="col">구분</th>
              <th scope="col">결과</th>
              <th scope="col" aria-label="듣기" />
            </tr>
          </thead>
          <tbody>
            {entries.map(({ item, kind, grade }) => (
              <tr key={`${item.id}-${kind}`}>
                <td>
                  <Term item={item} className="log-term" />
                </td>
                <td lang="ja">{item.kind === 'word' ? item.reading : '-'}</td>
                <td>{item.kind === 'word' ? toRomaji(item.reading) : item.reading}</td>
                <td>{item.kind === 'word' ? item.meaning : '-'}</td>
                <td>{KIND_LABEL[kind]}</td>
                <td className={grade ? `log-grade log-grade--${grade}` : 'muted'}>{grade ? GRADE_LABEL.get(grade) : '-'}</td>
                <td>
                  <SpeakButton text={item.term} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
