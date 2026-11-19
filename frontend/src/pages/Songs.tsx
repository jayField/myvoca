import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloseIcon, SearchIcon } from '../components/Icons';
import { listSongs, matchesSong, type Song } from '../lib/songs';

/** 노래: the songs registered ahead of time. Picking one opens it with its video and lyrics. */
export default function Songs() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    listSongs()
      .then(setSongs)
      .catch((e: Error) => setError(e.message));
  }, []);

  const shown = songs?.filter((s) => matchesSong(s, query)) ?? null;

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>노래</h1>
          <p className="muted small">유튜브로 노래를 들으면서 가사를 한 줄씩 따라가요{songs && songs.length > 0 && ` · ${songs.length}곡`}</p>
        </div>
      </header>

      {songs && songs.length > 0 && (
        <div className="phrase-search">
          <SearchIcon />
          <input
            type="search"
            className="text-input text-input--block"
            placeholder="노래 제목이나 가수 (예: 도라에몽)"
            aria-label="노래 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />
          {query && (
            <button type="button" className="icon-btn" aria-label="검색어 지우기" title="지우기" onClick={() => setQuery('')}>
              <CloseIcon />
            </button>
          )}
        </div>
      )}

      {error && <p className="banner-error">{error}</p>}
      {songs && songs.length === 0 && <p className="muted">아직 등록된 노래가 없어요.</p>}
      {songs && songs.length > 0 && shown?.length === 0 && <p className="muted">'{query.trim()}'에 맞는 노래가 없어요.</p>}

      {shown && shown.length > 0 && (
        <ul className="song-list">
          {shown.map((s) => (
            <li key={s.id}>
              <Link to={`/songs/${s.id}`} className="card song-row">
                <span>
                  <span className="deck-title">{s.title_ko || s.title_ja}</span>
                  {s.title_ko && (
                    <span lang="ja" className="muted small song-card-ja">
                      {s.title_ja}
                    </span>
                  )}
                </span>
                <span className="muted small song-row-artist">{s.artist}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
