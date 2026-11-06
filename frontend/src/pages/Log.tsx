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

      {days?.map(({ day, entries }) => (
        <section key={day} aria-labelledby={`log-${day}`} className="stack-sm">
          <h2 id={`log-${day}`} className="section-title day-title">
            {dayLabel(day)} <span className="muted small">· {entries.length}개</span>
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
      ))}
    </div>
  );
}
