import { PATTERN_TABLES, spokenPattern, type PatternTable } from '../lib/patterns';
import { speak } from '../speech';

/** 표현패턴표: each group of sentence patterns as its own table. Tapping the Japanese reads it aloud. */
export default function Patterns() {
  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>표현패턴표</h1>
          <p className="muted small">문장 틀을 통째로 익혀 두면 바로 꺼내 쓸 수 있어요. 일본어를 누르면 발음을 들려줘요.</p>
        </div>
      </header>

      {PATTERN_TABLES.map((table, i) => (
        <Table key={table.id} table={table} number={i + 1} />
      ))}
    </div>
  );
}

function Table({ table, number }: { table: PatternTable; number: number }) {
  const hasUse = table.rows.some((r) => r.use);
  return (
    <section className="pattern-section" aria-labelledby={`pattern-${table.id}`}>
      <h2 id={`pattern-${table.id}`} className="section-title">
        {number}. {table.title}
      </h2>
      <div className="card pattern-card">
        <table className="pattern-table">
          <thead>
            <tr>
              <th scope="col">{table.koLabel}</th>
              <th scope="col">일본어 / 발음</th>
              {hasUse && <th scope="col">뜻</th>}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.ko}>
                <th scope="row">{r.ko}</th>
                <td>
                  <button
                    type="button"
                    className="pattern-ja"
                    aria-label={`${r.ja} 발음 듣기`}
                    onClick={() => speak(spokenPattern(r.ja))}
                  >
                    <span lang="ja">{r.ja}</span>
                    <span className="muted small">{r.sound}</span>
                  </button>
                </td>
                {hasUse && <td className="muted small">{r.use}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
