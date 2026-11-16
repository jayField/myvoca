import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { BackIcon, CloseIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { WordBreakdown } from '../components/WordBreakdown';
import { dayLabel, localDate } from '../lib/dates';
import { deletePhrase, listPhrases, phraseSound, TALK_DECK } from '../lib/phrases';

/** Saved phrases by the day they were saved, newest day first (the list already arrives newest first). */
function groupByDay(phrases: Phrase[]): [string, Phrase[]][] {
  const groups = new Map<string, Phrase[]>();
  for (const p of phrases) {
    const day = localDate(new Date(p.created_at));
    groups.set(day, [...(groups.get(day) ?? []), p]);
  }
  return [...groups.entries()];
}

const PHONE = '(max-width: 760px)';

/** Whether the screen is phone-sized, following rotation and window resizes. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

/** 회화 노트 as a deck: everything saved so far, like the other decks' word lists. Adding happens on /talk. */
export default function PhraseDeck() {
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Phones skip the reading and example columns; leaving them out (not hiding them) keeps the breakdown row's span right.
  const narrow = useNarrow();

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function remove(p: Phrase) {
    if (!window.confirm(`'${p.japanese}'를 회화 노트에서 지울까요?`)) return;
    try {
      await deletePhrase(p.id);
      setPhrases((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/decks" className="back-link">
            <BackIcon />
            단어장
          </Link>
          <h1>{TALK_DECK.title}</h1>
          <p className="muted small">
            {TALK_DECK.description}
            {phrases && ` · ${phrases.length}개`}
          </p>
        </div>
        <div className="button-row">
          <Link to="/talk" className="btn btn--primary">
            표현 추가
          </Link>
          <Link to={`/quiz?deck=${TALK_DECK.id}`} className="btn btn--ghost">
            이 범위로 퀴즈
          </Link>
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {phrases && phrases.length === 0 && (
        <p className="muted">
          아직 저장한 표현이 없어요. <Link to="/talk">표현 추가</Link>에서 번역해서 저장해 보세요.
        </p>
      )}

      {phrases &&
        groupByDay(phrases).map(([day, group]) => (
          <section key={day} aria-labelledby={`phrase-${day}`} className="stack-sm">
            <h2 id={`phrase-${day}`} className="section-title day-title">
              {dayLabel(day)} <span className="muted small">· {group.length}개</span>
            </h2>
            <div className="log-scroll">
              <table className="log-table phrase-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-term">
                      표현
                    </th>
                    {!narrow && (
                      <th scope="col" className="col-reading">
                        읽기
                      </th>
                    )}
                    <th scope="col" className="col-sound">
                      발음
                    </th>
                    <th scope="col" className="col-meaning">
                      뜻
                    </th>
                    {!narrow && <th scope="col">예시</th>}
                    <th scope="col" className="col-button" aria-label="듣기" />
                    <th scope="col" className="col-button" aria-label="삭제" />
                  </tr>
                </thead>
                <tbody>
                  {group.map((p) => (
                    <Fragment key={p.id}>
                      <tr className={p.words.length > 1 ? 'phrase-row--split' : undefined}>
                        <td lang="ja" className="log-term">
                          {p.japanese}
                        </td>
                        {!narrow && <td lang="ja">{p.reading}</td>}
                        <td>{phraseSound(p)}</td>
                        <td>{p.meaning}</td>
                        {!narrow && (
                          <td>
                            {p.example_ja ? (
                              <span className="phrase-example">
                                <span lang="ja">{p.example_ja}</span>
                                <span className="muted">{p.example_ko}</span>
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        )}
                        <td className="cell-button">
                          <SpeakButton text={p.japanese} />
                        </td>
                        <td className="cell-button">
                          <button
                            type="button"
                            className="icon-btn icon-btn--delete"
                            aria-label={`${p.japanese} 삭제`}
                            title="삭제"
                            onClick={() => void remove(p)}
                          >
                            <CloseIcon />
                          </button>
                        </td>
                      </tr>
                      {p.words.length > 1 && (
                        <tr className="phrase-words-row">
                          <td colSpan={narrow ? 5 : 7}>
                            <WordBreakdown words={p.words} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}
