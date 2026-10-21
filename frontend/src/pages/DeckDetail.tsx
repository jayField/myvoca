import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, SERVER_ERROR, type DeckItem } from '../api';
import { BackIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { STATUS_LABEL } from '../labels';

export default function DeckDetail() {
  const { deckId = '' } = useParams();
  const [deck, setDeck] = useState<{ title: string; description: string } | null>(null);
  const [items, setItems] = useState<DeckItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .deckItems(deckId)
      .then((res) => {
        setDeck(res.deck);
        setItems(res.items);
        setError(null);
      })
      // fetch rejects with a TypeError when the server is unreachable; API errors carry their own message.
      .catch((e) => setError(e instanceof TypeError || !(e instanceof Error) ? SERVER_ERROR : e.message));
  }, [deckId]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/decks" className="back-link">
            <BackIcon />
            단어장
          </Link>
          <h1>{deck?.title ?? ''}</h1>
          {deck && <p className="muted small">{deck.description}</p>}
        </div>
        <Link to={`/quiz?deck=${deckId}`} className="btn btn--ghost">
          이 범위로 퀴즈
        </Link>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {deck && items.length === 0 && <p className="muted">아직 모인 단어가 없어요.</p>}

      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id} className="item-row">
            <span lang="ja" className="item-term">
              {item.term}
            </span>
            <span className="item-text">
              {item.kind === 'word' ? (
                <>
                  <span lang="ja">{item.reading}</span>
                  <span className="muted">{item.meaning}</span>
                </>
              ) : (
                <span>{item.reading}</span>
              )}
            </span>
            <span className={`badge badge--${item.status}`}>{STATUS_LABEL[item.status]}</span>
            <SpeakButton text={item.term} />
          </li>
        ))}
      </ul>
    </div>
  );
}
