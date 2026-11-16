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

export default function Numbers() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>숫자</h1>
          <p className="muted small">1부터 10까지 음독, 훈독, 사람 세기예요. 읽는 법을 누르면 발음을 들려줘요.</p>
        </div>
        <Link to={`/quiz?deck=${NUMBER_DECK.id}`} className="btn btn--ghost">
          퀴즈로 풀기
        </Link>
      </header>

      <section className="kana-section stack-sm" aria-label="1부터 10까지">
        <div className="kana-scroll">
          <table className="kana-table number-table">
            <thead>
              <tr>
                <th scope="col">숫자</th>
                <th scope="col">음독</th>
                <th scope="col">훈독</th>
                <th scope="col">사람 (~人)</th>
              </tr>
            </thead>
            <tbody>
              {NUMBERS.map((row) => (
                <tr key={row.n}>
                  <th scope="row">
                    <span className="number-digit">{row.n}</span>
                    <span lang="ja" className="number-kanji">
                      {row.kanji}
                    </span>
                  </th>
                  <td>
                    <span className="number-readings">
                      {row.on.map((kana) => (
                        <Reading key={kana} kana={kana} />
                      ))}
                    </span>
                  </td>
                  <td>
                    <Reading kana={row.kun} />
                  </td>
                  <td>
                    <span className="number-readings">
                      {row.people.map((kana) => (
                        <Reading key={kana} kana={kana} />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="muted small number-notes">
          <li>
            <strong>음독</strong>은 숫자를 셀 때 써요. 전화번호, 가격, 날짜 등 대부분의 숫자가 음독이에요.
          </li>
          <li>
            <strong>훈독</strong>(~つ)은 물건 개수를 셀 때 써요. 하나, 둘, 셋처럼요.
          </li>
          <li>
            <strong>사람</strong>은 숫자 뒤에 ~人(にん)을 붙여 세요. 1명·2명만 ひとり·ふたり로 따로 읽고, 4명은 よにん이에요.
          </li>
          <li>4, 7, 9는 읽는 법이 둘이에요. 보통은 앞의 것(よん, なな, きゅう)을 써요.</li>
        </ul>
      </section>
    </div>
  );
}
