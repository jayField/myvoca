import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSongs, type Song } from '../lib/songs';

/** 노래: the songs registered ahead of time. Picking one opens it with its video and lyrics. */
export default function Songs() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSongs()
      .then(setSongs)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>노래</h1>
          <p className="muted small">유튜브로 노래를 들으면서 가사를 한 줄씩 따라가요{songs && songs.length > 0 && ` · ${songs.length}곡`}</p>
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {songs && songs.length === 0 && <p className="muted">아직 등록된 노래가 없어요.</p>}

      {songs && songs.length > 0 && (
        <ul className="deck-grid song-grid">
          {songs.map((s) => (
            <li key={s.id}>
              <Link to={`/songs/${s.id}`} className="card deck-card">
                <span>
                  <span className="deck-title">{s.title_ko || s.title_ja}</span>
                  {s.title_ko && (
                    <span lang="ja" className="muted small song-card-ja">
                      {s.title_ja}
                    </span>
                  )}
                </span>
                <span className="muted small">{s.artist}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
