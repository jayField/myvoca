import { toHangul } from '../lib/kana';
import { speak } from '../speech';

/**
 * 1 to 10 in both readings. 음독 (Chinese-derived) is for counting and most numbers; 훈독 (native) is the
 * ~つ series for counting things. Where two readings are in everyday use, the more common one comes first.
 */
const NUMBERS: { n: number; kanji: string; on: string[]; kun: string }[] = [
  { n: 1, kanji: '一', on: ['いち'], kun: 'ひとつ' },
  { n: 2, kanji: '二', on: ['に'], kun: 'ふたつ' },
  { n: 3, kanji: '三', on: ['さん'], kun: 'みっつ' },
  { n: 4, kanji: '四', on: ['よん', 'し'], kun: 'よっつ' },
  { n: 5, kanji: '五', on: ['ご'], kun: 'いつつ' },
  { n: 6, kanji: '六', on: ['ろく'], kun: 'むっつ' },
  { n: 7, kanji: '七', on: ['なな', 'しち'], kun: 'ななつ' },
  { n: 8, kanji: '八', on: ['はち'], kun: 'やっつ' },
  { n: 9, kanji: '九', on: ['きゅう', 'く'], kun: 'ここのつ' },
  { n: 10, kanji: '十', on: ['じゅう'], kun: 'とお' },
];

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
          <p className="muted small">1부터 10까지 음독과 훈독이에요. 읽는 법을 누르면 발음을 들려줘요.</p>
        </div>
      </header>

      <section className="kana-section stack-sm" aria-label="1부터 10까지">
        <div className="kana-scroll">
          <table className="kana-table number-table">
            <thead>
              <tr>
                <th scope="col">숫자</th>
                <th scope="col">음독</th>
                <th scope="col">훈독</th>
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
          <li>4, 7, 9는 읽는 법이 둘이에요. 보통은 앞의 것(よん, なな, きゅう)을 써요.</li>
        </ul>
      </section>
    </div>
  );
}
