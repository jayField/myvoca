import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { phraseSound } from '../lib/phrases';
import { deleteSong, getSong, lineAt, saveOffset, type Song as SongData } from '../lib/songs';
import { createPlayer, PLAYING, playerError, type YouTubePlayer } from '../lib/youtube';

/** How often the lyrics check where the video is, in milliseconds. */
const TICK = 150;
/** One press of the sync buttons, in milliseconds. */
const SYNC_STEP = 500;
/** How long after the last sync press it is saved, so a run of presses is one save. */
const SAVE_DELAY = 800;

const signed = (ms: number) => `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${(Math.abs(ms) / 1000).toFixed(1)}초`;

/**
 * One song, karaoke style: the YouTube video stays at the top while the lyrics below follow it, the line
 * being sung lit and kept in view, each with its Hangul pronunciation and meaning. Pressing a line plays
 * from there.
 */
export default function Song() {
  const { songId = '' } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(-1);
  const [offset, setOffset] = useState(0);

  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const lineEls = useRef(new Map<number, HTMLElement>());
  const offsetRef = useRef(0);
  const saveTimer = useRef<number>(undefined);

  useEffect(() => {
    getSong(songId)
      .then((s) => {
        if (!s) return setError('노래를 찾을 수 없어요. 지워졌을 수 있어요.');
        offsetRef.current = s.offset_ms;
        setOffset(s.offset_ms);
        setSong(s);
      })
      .catch((e: Error) => setError(e.message));
  }, [songId]);

  // The player, and a clock that moves the lit line along with the video.
  useEffect(() => {
    const box = host.current;
    if (!song || !box) return;
    // The API swaps its element for an iframe, so give it one React doesn't manage.
    const mount = document.createElement('div');
    box.append(mount);
    let cancelled = false;
    let timer: number | undefined;
    let at = -1;
    createPlayer(
      mount,
      song.youtube_id,
      () => {},
      (code) => setError(playerError(code)),
    )
      .then((p) => {
        if (cancelled) return p.destroy();
        player.current = p;
        timer = window.setInterval(() => {
          const now = lineAt(song.lines, p.getCurrentTime(), offsetRef.current / 1000);
          if (now === at) return;
          at = now;
          setCurrent(now);
          if (p.getPlayerState() === PLAYING) keepInView(now);
        }, TICK);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      player.current?.destroy();
      player.current = null;
      box.replaceChildren();
    };
  }, [song]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  /** Scrolls so line `i` sits in the middle of what is visible below the video. */
  function keepInView(i: number) {
    const el = lineEls.current.get(i);
    if (!el) return;
    const top = stage.current?.getBoundingClientRect().bottom ?? 0;
    const box = el.getBoundingClientRect();
    const middle = top + (window.innerHeight - top) / 2;
    window.scrollBy({ top: box.top + box.height / 2 - middle, behavior: 'smooth' });
  }

  function playFrom(i: number) {
    const p = player.current;
    if (!p || !song) return;
    p.seekTo(Math.max(0, song.lines[i].t + offsetRef.current / 1000), true);
    p.playVideo();
  }

  function shift(by: number) {
    if (!song) return;
    const next = Math.max(-60000, Math.min(60000, offsetRef.current + by));
    offsetRef.current = next;
    setOffset(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveOffset(song.id, next).catch((e: Error) => setError(e.message));
    }, SAVE_DELAY);
  }

  async function remove() {
    if (!song || !window.confirm(`'${song.title_ko || song.title_ja}'를 지울까요?`)) return;
    try {
      await deleteSong(song.id);
      navigate('/songs');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page page--narrow song-page">
      <header className="page-header">
        <div>
          <Link to="/songs" className="back-link">
            <BackIcon />
            노래
          </Link>
          <h1>{song ? song.title_ko || song.title_ja : '노래'}</h1>
          {song && (
            <p className="muted small">
              <span lang="ja">{song.title_ko ? song.title_ja : ''}</span>
              {song.title_ko && song.artist && ' · '}
              {song.artist}
            </p>
          )}
        </div>
        {song && (
          <div className="button-row">
            <button type="button" className="btn btn--ghost" onClick={() => void remove()}>
              삭제
            </button>
          </div>
        )}
      </header>

      {error && <p className="banner-error">{error}</p>}

      {song && (
        <>
          <div ref={stage} className="song-stage">
            <div ref={host} className="song-video" />
            <div className="song-sync">
              <span className="muted small">가사 싱크 {signed(offset)}</span>
              <span className="button-row">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => shift(-SYNC_STEP)} aria-label="가사 0.5초 빠르게">
                  −0.5초
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => shift(SYNC_STEP)} aria-label="가사 0.5초 늦게">
                  +0.5초
                </button>
              </span>
            </div>
          </div>
          <p className="hint">가사가 노래보다 빨리 나오면 +, 늦게 나오면 −를 눌러요. 줄을 누르면 거기서부터 재생해요.</p>

          <ol className="lyrics">
            {song.lines.map((line, i) =>
              line.japanese ? (
                <li key={i} ref={(el) => void (el ? lineEls.current.set(i, el) : lineEls.current.delete(i))}>
                  <button
                    type="button"
                    className={`lyric${i === current ? ' is-current' : i < current ? ' is-past' : ''}`}
                    aria-current={i === current || undefined}
                    onClick={() => playFrom(i)}
                  >
                    <span lang="ja" className="lyric-ja">
                      {line.japanese}
                    </span>
                    <span className="lyric-sound">{phraseSound(line)}</span>
                    {line.meaning && <span className="lyric-meaning">{line.meaning}</span>}
                  </button>
                </li>
              ) : (
                <li key={i} className="lyric-break" aria-hidden="true">
                  ♪
                </li>
              ),
            )}
          </ol>
        </>
      )}
    </div>
  );
}
