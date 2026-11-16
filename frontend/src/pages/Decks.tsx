import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataVersion } from '../auth';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck } from '../api';
import { listPhrases, TALK_DECK } from '../lib/phrases';

export default function Decks() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [confusing, setConfusing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Phrases live on the account, so the count shows only once it loads (never when signed out or offline).
  const [phraseCount, setPhraseCount] = useState<number | null>(null);

  useEffect(() => {
    listPhrases()
      .then((list) => setPhraseCount(list.length))
      .catch(() => setPhraseCount(null));
  }, []);

  const dataVersion = useDataVersion();
  useEffect(() => {
    api
      .decks()
      .then((res) => {
        setDecks(res.decks);
        setConfusing(res.confusing);
      })
      .catch(() => setError(LOAD_ERROR));
  }, [dataVersion]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>단어장</h1>
      </header>
      {error && <p className="banner-error">{error}</p>}
      <div className="deck-grid">
        {decks?.map((deck) => (
          <Link key={deck.id} to={`/decks/${deck.id}`} className="card deck-card deck-card--tall">
            <div>
              <span className="deck-title">{deck.title}</span>
              <p className="muted small">{deck.description}</p>
            </div>
            <div>
              <div className="progress progress--thin">
                <div className="progress-fill" style={{ width: `${(deck.learned / deck.total) * 100}%` }} />
              </div>
              <span className="muted small">
                {deck.total}개 중 {deck.learned}개 학습
              </span>
            </div>
          </Link>
        ))}
        {decks && (
          <Link to="/talk" className="card deck-card deck-card--tall deck-card--talk">
            <div>
              <span className="deck-title">
                {TALK_DECK.title} {phraseCount !== null && <span className="accent-text">{phraseCount}</span>}
              </span>
              <p className="muted small">{TALK_DECK.description}. 한글 발음으로 적으면 일본어로 바꿔줘요.</p>
            </div>
          </Link>
        )}
        {decks && (
          <Link to={`/decks/${CONFUSING_DECK_ID}`} className="card deck-card deck-card--tall deck-card--danger">
            <div>
              <span className="deck-title">
                헷갈리는 단어 <span className="danger-text">{confusing}</span>
              </span>
              <p className="muted small">마지막에 몰랐음·헷갈림으로 표시한 단어가 자동으로 모여요.</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
