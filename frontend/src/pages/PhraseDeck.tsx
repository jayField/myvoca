import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { BackIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { dayLabel, localDate } from '../lib/dates';
import { toRomaji } from '../lib/kana';
import { deletePhrase, listPhrases, TALK_DECK } from '../lib/phrases';

/** Saved phrases by the day they were saved, newest day first (the list already arrives newest first). */
function groupByDay(phrases: Phrase[]): [string, Phrase[]][] {
  const groups = new Map<string, Phrase[]>();
  for (const p of phrases) {
    const day = localDate(new Date(p.created_at));
    groups.set(day, [...(groups.get(day) ?? []), p]);
  }
  return [...groups.entries()];
}

/** 회화 노트 as a deck: everything saved so far, like the other decks' word lists. Adding happens on /talk. */
export default function PhraseDeck() {
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <ul className="item-list">
              {group.map((p) => (
                <li key={p.id} className="item-row">
                  <span lang="ja" className="item-term talk-deck-term">
                    {p.japanese}
                  </span>
                  <span className="item-text">
                    {p.reading !== p.japanese && <span lang="ja">{p.reading}</span>}
                    <span className="muted">{toRomaji(p.reading)}</span>
                    <span>{p.meaning}</span>
                  </span>
                  <SpeakButton text={p.japanese} />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void remove(p)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
