import { Link } from 'react-router-dom';
import { toHangul } from '../lib/kana';
import { NUMBER_DECK, NUMBERS } from '../lib/numbers';
import { speak } from '../speech';

function Reading({ kana }: { kana: string }) {
  return (
    <button type="button" className="number-reading" aria-label={`${kana} 발음 듣기`} onClick={() => speak(kana)}>
      <span lang="ja" className="number-kana">
        {kana}
      </span>
      <span className="number-sound">{toHangul(kana)}</span>
    </button>
  );
}

type Row = (typeof NUMBERS)[number];

/** One table per way of reading 1–10: how it is written and how it is read. */
const TABLES: { id: string; title: string; note: string; written: (r: Row) => string; readings: (r: Row) => string[] }[] = [
  {
    id: 'on',
    title: '숫자 읽기 (음독)',
    note: '숫자를 셀 때 써요. 전화번호, 가격, 날짜 등 대부분이 이 읽기예요. 4·7·9는 보통 앞의 것(よん·なな·きゅう)을 써요.',
    written: (r) => r.kanji,
    readings: (r) => r.on,
  },
  {
    id: 'kun',
    title: '물건 세기 (~つ)',
    note: '물건 개수를 셀 때 써요. 하나, 둘, 셋처럼요. 10개는 つ 없이 とお예요.',
    written: (r) => r.kunWritten,
    readings: (r) => [r.kun],
  },
  {
    id: 'people',
    title: '사람 세기 (~人)',
    note: '숫자 뒤에 ~人(にん)을 붙여요. 1명·2명만 ひとり·ふたり로 따로 읽고, 4명은 よにん이에요.',
    written: (r) => `${r.kanji}人`,
    readings: (r) => r.people,
  },
];

export default function Numbers() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>숫자</h1>
          <p className="muted small">1부터 10까지 숫자 읽기, 물건 세기, 사람 세기예요. 읽는 법을 누르면 발음을 들려줘요.</p>
        </div>
        <Link to={`/quiz?deck=${NUMBER_DECK.id}`} className="btn btn--ghost">
          퀴즈로 풀기
        </Link>
      </header>

      <div className="number-tables">
        {TABLES.map((t) => (
          <section key={t.id} aria-labelledby={`numbers-${t.id}`} className="stack-sm">
            <h2 id={`numbers-${t.id}`} className="section-title">
              {t.title}
            </h2>
            <p className="muted small number-note">{t.note}</p>
            <div className="kana-scroll">
              <table className="kana-table number-table">
                <thead>
                  <tr>
                    <th scope="col">숫자</th>
                    <th scope="col">읽기</th>
                  </tr>
                </thead>
                <tbody>
                  {NUMBERS.map((row) => (
                    <tr key={row.n}>
                      <th scope="row">
                        <span className="number-digit">{row.n}</span>
                        <span lang="ja" className="number-kanji">
                          {t.written(row)}
                        </span>
                      </th>
                      <td>
                        <span className="number-readings">
                          {t.readings(row).map((kana) => (
                            <Reading key={kana} kana={kana} />
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
