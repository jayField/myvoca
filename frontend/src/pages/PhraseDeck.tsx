import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { BackIcon, CloseIcon, DownloadIcon, EditIcon } from '../components/Icons';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditor } from '../components/PhraseEditor';
import { SpeakButton } from '../components/SpeakButton';
import { WordBreakdown } from '../components/WordBreakdown';
import { dayLabel } from '../lib/dates';
import { deletePhrase, exampleSound, groupByDay, listPhrases, phraseSound, TALK_DECK } from '../lib/phrases';

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
  // Phones get one card per phrase; a table split into columns is too cramped there.
  const narrow = useNarrow();
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  function saved(p: Phrase) {
    setPhrases((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null);
    setEditing(null);
  }

  async function exportPdf() {
    if (!phrases?.length) return;
    setExporting(true);
    setError(null);
    try {
      const { downloadPhrasesPdf } = await import('../lib/phrasePdf');
      await downloadPhrasesPdf(phrases);
    } catch {
      setError('PDF를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setExporting(false);
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
            {narrow ? '퀴즈' : '이 범위로 퀴즈'}
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => void exportPdf()} disabled={!phrases?.length || exporting}>
            <DownloadIcon />
            {exporting ? (narrow ? '만드는 중…' : 'PDF 만드는 중…') : narrow ? 'PDF' : 'PDF 다운로드'}
          </button>
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
            {narrow ? (
              <ul className="item-list">
                {group.map((p) =>
                  editing === p.id ? (
                    <li key={p.id} className="item-row phrase-card phrase-card--editing">
                      <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />
                    </li>
                  ) : (
                    <PhraseCard key={p.id} phrase={p} onEdit={() => setEditing(p.id)} onDelete={() => void remove(p)} />
                  ),
                )}
              </ul>
            ) : (
            <div className="log-scroll">
              <table className="log-table phrase-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-term">
                      표현
                    </th>
                    <th scope="col" className="col-reading">
                      읽기
                    </th>
                    <th scope="col" className="col-sound">
                      발음
                    </th>
                    <th scope="col" className="col-meaning">
                      뜻
                    </th>
                    <th scope="col">예시</th>
                    <th scope="col" className="col-button" aria-label="듣기" />
                    <th scope="col" className="col-actions" aria-label="수정·삭제" />
                  </tr>
                </thead>
                <tbody>
                  {group.map((p) =>
                    editing === p.id ? (
                      <tr key={p.id} className="phrase-edit-row">
                        <td colSpan={7}>
                          <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />
                        </td>
                      </tr>
                    ) : (
                    <Fragment key={p.id}>
                      <tr className={p.words.length > 1 ? 'phrase-row--split' : undefined}>
                        <td lang="ja" className="log-term">
                          {p.japanese}
                        </td>
                        <td lang="ja">{p.reading}</td>
                        <td>{phraseSound(p)}</td>
                        <td>
                          {p.meaning}
                          {p.note && <span className="phrase-note">{p.note}</span>}
                        </td>
                          <td>
                            {p.example_ja ? (
                              <span className="phrase-example">
                                <span lang="ja">{p.example_ja}</span>
                                {exampleSound(p) && <span className="talk-example-sound">{exampleSound(p)}</span>}
                                <span className="muted">{p.example_ko}</span>
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        <td className="cell-button">
                          <SpeakButton text={p.japanese} />
                        </td>
                        <td className="cell-button">
                          <span className="phrase-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`${p.japanese} 수정`}
                            title="수정"
                            onClick={() => setEditing(p.id)}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--delete"
                            aria-label={`${p.japanese} 삭제`}
                            title="삭제"
                            onClick={() => void remove(p)}
                          >
                            <CloseIcon />
                          </button>
                          </span>
                        </td>
                      </tr>
                      {p.words.length > 1 && (
                        <tr className="phrase-words-row">
                          <td colSpan={7}>
                            <WordBreakdown words={p.words} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>
        ))}
    </div>
  );
}
