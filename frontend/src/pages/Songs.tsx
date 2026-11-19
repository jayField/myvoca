import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clock, listSongs, saveSong, searchLyrics, youtubeId, type LyricsMatch, type Song } from '../lib/songs';

const MAX_TITLE = 100;

/** 노래: the songs added so far, and adding one: its titles, a YouTube link, and timed lyrics picked from LRCLIB. */
export default function Songs() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title_ko: '', title_ja: '', artist: '', link: '' });
  const [matches, setMatches] = useState<LyricsMatch[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState<'search' | 'save' | null>(null);

  useEffect(() => {
    listSongs()
      .then((list) => {
        setSongs(list);
        if (!list.length) setAdding(true);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }),
  });

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!form.title_ja.trim()) return;
    setBusy('search');
    setError(null);
    setMatches(null);
    try {
      let found = await searchLyrics(form.title_ja, form.artist);
      // A singer spelled differently from LRCLIB's would hide everything, so fall back to the title alone.
      if (!found.length && form.artist.trim()) found = await searchLyrics(form.title_ja);
      setMatches(found);
      setPicked(found[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const match = matches?.find((m) => m.id === picked);
    const id = youtubeId(form.link);
    if (!match) return;
    if (!id) {
      setError('유튜브 링크를 확인해 주세요. 예) https://www.youtube.com/watch?v=…');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const song = await saveSong(
        { title_ko: form.title_ko.trim(), title_ja: form.title_ja.trim(), artist: form.artist.trim() || match.artist, youtube_id: id },
        match.lrc,
      );
      navigate(`/songs/${song.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>노래</h1>
          <p className="muted small">유튜브로 노래를 들으면서 가사를 한 줄씩 따라가요{songs && songs.length > 0 && ` · ${songs.length}곡`}</p>
        </div>
        {!adding && (
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              노래 추가
            </button>
          </div>
        )}
      </header>

      {error && <p className="banner-error">{error}</p>}

      {adding && (
        <form className="card card--lg talk-card" onSubmit={search}>
          <h2 className="card-title">노래 추가</h2>
          <div className="song-form-grid">
            <label className="talk-field">
              <span>한글 제목</span>
              <input className="text-input text-input--block" maxLength={MAX_TITLE} placeholder="예) 도라에몽" {...field('title_ko')} />
            </label>
            <label className="talk-field">
              <span>일본어 제목 (가사 검색에 써요)</span>
              <input lang="ja" className="text-input text-input--block" maxLength={MAX_TITLE} placeholder="예) 夢をかなえてドラえもん" required {...field('title_ja')} />
            </label>
            <label className="talk-field">
              <span>가수 (선택)</span>
              <input className="text-input text-input--block" maxLength={MAX_TITLE} placeholder="예) mao" {...field('artist')} />
            </label>
            <label className="talk-field">
              <span>유튜브 링크</span>
              <input className="text-input text-input--block" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" required {...field('link')} />
            </label>
          </div>
          <div className="button-row">
            <button type="submit" className={`btn ${matches?.length ? 'btn--ghost' : 'btn--primary'}`} disabled={!form.title_ja.trim() || busy !== null}>
              {busy === 'search' ? '찾는 중…' : matches ? '다시 찾기' : '가사 찾기'}
            </button>
            {songs && songs.length > 0 && (
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)} disabled={busy !== null}>
                취소
              </button>
            )}
          </div>

          {matches && matches.length === 0 && (
            <p className="muted small">시간이 맞춰진 가사를 찾지 못했어요. 일본어 제목을 원래 표기 그대로 적었는지 확인해 주세요.</p>
          )}
          {matches && matches.length > 0 && (
            <fieldset className="song-matches">
              <legend className="hint">가사를 골라 주세요. 영상 길이와 비슷한 걸 고르면 잘 맞아요.</legend>
              {matches.slice(0, 8).map((m) => (
                <label key={m.id} className={`song-match${picked === m.id ? ' is-picked' : ''}`}>
                  <input type="radio" name="lyrics" checked={picked === m.id} onChange={() => setPicked(m.id)} />
                  <span className="song-match-text">
                    <span lang="ja" className="song-match-title">
                      {m.track}
                    </span>
                    <span className="muted small">
                      {m.artist} · {clock(m.duration)}
                    </span>
                    <span lang="ja" className="muted small song-match-preview">
                      {m.lrc
                        .split('\n')
                        .map((l) => l.replace(/^(\[[^\]]*\])+/, '').trim())
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(' / ')}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {matches && matches.length > 0 && (
            <div className="button-row">
              <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={picked === null || !form.link.trim() || busy !== null}>
                {busy === 'save' ? '가사 해석 중… (30초쯤 걸려요)' : '저장'}
              </button>
            </div>
          )}
        </form>
      )}

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
