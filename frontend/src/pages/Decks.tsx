import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck } from '../api';

export default function Decks() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [confusing, setConfusing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .decks()
      .then((res) => {
        setDecks(res.decks);
        setConfusing(res.confusing);
      })
      .catch(() => setError(LOAD_ERROR));
  }, []);

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
                {deck.total}개 중 {deck.learned}개 학습{deck.due > 0 && ` · 오늘 복습 ${deck.due}`}
              </span>
            </div>
          </Link>
        ))}
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
