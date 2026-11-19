import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BackIcon, EditIcon } from '../components/Icons';
import { LyricEditor } from '../components/LyricEditor';
import { getSong, lineAt, lineSound, saveLines, saveOffset, type Song as SongData, type SongLine } from '../lib/songs';
import { createPlayer, PLAYING, playerError, type YouTubePlayer } from '../lib/youtube';

/** How often the lyrics check where the video is, in milliseconds. */
const TICK = 150;
/** One press of the sync buttons, in milliseconds. */
const SYNC_STEP = 100;
/** How long after the last sync press it is saved, so a run of presses is one save. */
const SAVE_DELAY = 800;

const signed = (ms: number) => `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${(Math.abs(ms) / 1000).toFixed(1)}초`;

/**
 * One song, karaoke style: the YouTube video stays at the top while the lyrics below follow it, the line
 * being sung lit and kept in view, each with its Hangul pronunciation and meaning. Pressing a line plays
 * from there. 가사 수정 gives every line a ✏️ to fix its words or timing.
 */
export default function Song() {
  const { songId = '' } = useParams();
  const [song, setSong] = useState<SongData | null>(null);
  const [editMode, setEditMode] = useState(false);
  /** The line open in the editor, by index. */
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(-1);
  const [offset, setOffset] = useState(0);

  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const lineEls = useRef(new Map<number, HTMLElement>());
  const offsetRef = useRef(0);
  const linesRef = useRef<SongLine[]>([]);
  linesRef.current = song?.lines ?? [];
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

  // Editing lyrics changes `song`; only a different video needs a new player.
  const videoId = song?.youtube_id;

  // The player, and a clock that moves the lit line along with the video.
  useEffect(() => {
    const box = host.current;
    if (!videoId || !box) return;
    // The API swaps its element for an iframe, so give it one React doesn't manage.
    const mount = document.createElement('div');
    box.append(mount);
    let cancelled = false;
    let timer: number | undefined;
    let at = -1;
    createPlayer(
      mount,
      videoId,
      () => {},
      (code) => setError(playerError(code)),
    )
      .then((p) => {
        if (cancelled) return p.destroy();
        player.current = p;
        timer = window.setInterval(() => {
          const now = lineAt(linesRef.current, p.getCurrentTime(), offsetRef.current / 1000);
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
  }, [videoId]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Lines scrolled into view stop below the sticky video rather than under it.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--song-stage', `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--song-stage');
    };
  }, [videoId]);

  // An opened editor comes into view just below the video.
  useEffect(() => {
    if (editing !== null) document.querySelector('.lyric-editing')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [editing]);

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

  /** Where the video is on the lyrics' own clock, for the editor's 지금 button. */
  function lyricsNow(): number | null {
    const p = player.current;
    return p ? p.getCurrentTime() - offsetRef.current / 1000 : null;
  }

  /** Saves the lyrics with line `i` replaced (or removed when `line` is null). */
  async function storeLine(i: number, line: SongLine | null) {
    if (!song) return;
    const next = line ? song.lines.map((l, j) => (j === i ? line : l)) : song.lines.filter((_, j) => j !== i);
    const lines = await saveLines(song.id, next);
    setSong({ ...song, lines });
    setEditing(null);
  }

  function toggleEditMode() {
    setEditing(null);
    setEditMode(!editMode);
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
            <button type="button" className={`btn ${editMode ? 'btn--primary' : 'btn--ghost'}`} onClick={toggleEditMode}>
              {editMode ? '완료' : '가사 수정'}
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
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => shift(-SYNC_STEP)} aria-label="가사 0.1초 빠르게">
                  −0.1초
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => shift(SYNC_STEP)} aria-label="가사 0.1초 늦게">
                  +0.1초
                </button>
              </span>
            </div>
          </div>
          <p className="hint">
            {editMode
              ? '✏️를 눌러 줄마다 가사·발음·뜻·시작 시간을 고쳐요. 지금 버튼은 영상이 있는 곳을 그 줄의 시작으로 맞춰요.'
              : '가사가 노래보다 빨리 나오면 +, 늦게 나오면 −를 눌러요. 줄을 누르면 거기서부터 재생해요.'}
          </p>

          <ol className="lyrics">
            {song.lines.map((line, i) =>
              editing === i ? (
                <li key={i} className="lyric-editing">
                  <LyricEditor
                    line={line}
                    now={lyricsNow}
                    onSave={(l) => storeLine(i, l)}
                    onDelete={() => storeLine(i, null)}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : line.japanese ? (
                <li key={i} ref={(el) => void (el ? lineEls.current.set(i, el) : lineEls.current.delete(i))} className="lyric-row">
                  <button
                    type="button"
                    className={`lyric${i === current ? ' is-current' : i < current ? ' is-past' : ''}`}
                    aria-current={i === current || undefined}
                    onClick={() => playFrom(i)}
                  >
                    <span lang="ja" className="lyric-ja">
                      {line.japanese}
                    </span>
                    <span className="lyric-sound">{lineSound(line)}</span>
                    {line.meaning && <span className="lyric-meaning">{line.meaning}</span>}
                  </button>
                  {editMode && (
                    <button type="button" className="icon-btn lyric-edit-btn" aria-label={`${line.japanese} 수정`} title="수정" onClick={() => setEditing(i)}>
                      <EditIcon />
                    </button>
                  )}
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
