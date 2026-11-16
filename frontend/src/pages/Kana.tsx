import { useState } from 'react';
import { inScript, KANA_SECTIONS, type KanaCell, type KanaScript } from '../lib/kana';
import { speak } from '../speech';

const SCRIPT_KEY = 'tango-note.kana.script';

function initialScript(): KanaScript {
  try {
    return localStorage.getItem(SCRIPT_KEY) === 'katakana' ? 'katakana' : 'hiragana';
  } catch {
    return 'hiragana';
  }
}

/** あ행, か행, …; ん's row has no heading, as on printed charts. */
function rowLabel(row: KanaCell[], script: KanaScript): string {
  const first = row.find((cell) => cell)![0];
  return first === 'ん' ? '' : `${inScript(first[0], script)}행`;
}

export default function Kana() {
  const [script, setScript] = useState<KanaScript>(initialScript);

  function choose(next: KanaScript) {
    setScript(next);
    try {
      localStorage.setItem(SCRIPT_KEY, next);
    } catch {
      // Remembering the tab is only a convenience.
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>가나표</h1>
          <p className="muted small">로마자 표기와 한글 발음을 함께 보여줘요. 글자를 누르면 발음을 들려줘요.</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="문자 종류">
          {(['hiragana', 'katakana'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={script === s}
              className={script === s ? 'segment segment--on segment--good' : 'segment'}
              onClick={() => choose(s)}
            >
              {s === 'hiragana' ? '히라가나' : '가타카나'}
            </button>
          ))}
        </div>
      </header>

      {KANA_SECTIONS.map((section) => (
        <section key={section.id} aria-labelledby={`kana-${section.id}`} className="kana-section">
          <h2 id={`kana-${section.id}`} className="section-title">
            {section.title}
          </h2>
          <div className="kana-scroll">
            <table className="kana-table">
              <thead>
                <tr>
                  <th scope="col">행 / 단</th>
                  {section.columns.map((col) => (
                    <th key={col} scope="col">
                      <span lang="ja">{inScript(col, script)}</span>단
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, r) => (
                  <tr key={r}>
                    <th scope="row">{rowLabel(row, script)}</th>
                    {row.map((cell, c) => {
                      if (!cell) return <td key={c} />;
                      const text = inScript(cell[0], script);
                      return (
                        <td key={c}>
                          <button
                            type="button"
                            className="kana-cell"
                            aria-label={`${text}, ${cell[1]} 발음 듣기`}
                            onClick={() => speak(text)}
                          >
                            <span lang="ja" className="kana-char">
                              {text}
                            </span>
                            <span className="kana-romaji">
                              {cell[1]} {cell[2]}
                            </span>
                          </button>
                        </td>
                      );
                    })}
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
