import { useState } from 'react';
import { inScript, KANA_SECTIONS, type KanaScript } from '../lib/kana';
import { speak } from '../speech';

const SCRIPT_KEY = 'tango-note.kana.script';

function initialScript(): KanaScript {
  try {
    return localStorage.getItem(SCRIPT_KEY) === 'katakana' ? 'katakana' : 'hiragana';
  } catch {
    return 'hiragana';
  }
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
          <p className="muted small">글자를 누르면 발음을 들려줘요.</p>
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
          <div className="kana-grid" style={{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))` }}>
            {section.rows.flatMap((row, r) =>
              row.map((cell, c) => {
                if (!cell) return <span key={`${r}-${c}`} className="kana-cell kana-cell--empty" aria-hidden="true" />;
                const text = inScript(cell[0], script);
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className="kana-cell"
                    aria-label={`${text}, ${cell[1]} 발음 듣기`}
                    onClick={() => speak(text)}
                  >
                    <span lang="ja" className="kana-char">
                      {text}
                    </span>
                    <span className="kana-romaji">{cell[1]}</span>
                  </button>
                );
              }),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
