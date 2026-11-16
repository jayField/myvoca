import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { DragHandle } from '../components/DragHandle';
import { BackIcon, CloseIcon, DownloadIcon, EditIcon } from '../components/Icons';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditor } from '../components/PhraseEditor';
import { SpeakButton } from '../components/SpeakButton';
import { deletePhrase, listPhrases, phraseSound, placeAt, savePositions, TALK_DECK } from '../lib/phrases';

const PHONE = '(max-width: 760px)';
/** How close to the window's top or bottom edge a drag scrolls the page, and how far per move. */
const SCROLL_EDGE = 72;
const SCROLL_STEP = 14;

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

/** `list` with the phrase `id` moved to `index`. */
function moved(list: Phrase[], id: string, index: number): Phrase[] {
  const item = list.find((p) => p.id === id)!;
  const rest = list.filter((p) => p.id !== id);
  return [...rest.slice(0, index), item, ...rest.slice(index)];
}

/** 회화 노트 as a deck: everything saved so far, in the learner's own order. Adding happens on /talk. */
export default function PhraseDeck() {
  const [phrases, setPhrasesState] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Phones get one card per phrase; a table split into columns is too cramped there.
  const narrow = useNarrow();
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  // Pointer handlers read these directly, so a move right after pressing never sees a stale render.
  const listRef = useRef<Phrase[] | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{ id: string; before: Phrase[] } | null>(null);

  function setPhrases(next: Phrase[] | null) {
    listRef.current = next;
    setPhrasesState(next);
  }

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch((e: Error) => setError(e.message));
  }, []);

  const rowRef = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };

  /** Store the new place of `id`; on failure put the list back as it was. */
  async function commit(id: string, before: Phrase[]) {
    const list = listRef.current!;
    const index = list.findIndex((p) => p.id === id);
    if (before[index]?.id === id) return;
    const updates = placeAt(list, index);
    const position = new Map(updates.map((u) => [u.id, u.position]));
    setPhrases(list.map((p) => (position.has(p.id) ? { ...p, position: position.get(p.id)! } : p)));
    try {
      await savePositions(updates);
    } catch (e) {
      setPhrases(before);
      setError((e as Error).message);
    }
  }

  function dragTo(clientY: number) {
    const id = drag.current?.id;
    const list = listRef.current;
    if (!id || !list) return;
    if (clientY < SCROLL_EDGE) window.scrollBy(0, -SCROLL_STEP);
    else if (clientY > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, SCROLL_STEP);
    // The dragged row goes after every other row whose middle is above the pointer.
    const index = list.filter((p) => {
      if (p.id === id) return false;
      const box = rows.current.get(p.id)?.getBoundingClientRect();
      return box ? box.top + box.height / 2 < clientY : false;
    }).length;
    if (list[index]?.id !== id) setPhrases(moved(list, id, index));
  }

  function dragEnd() {
    const current = drag.current;
    drag.current = null;
    setDragging(null);
    if (current) void commit(current.id, current.before);
  }

  function step(id: string, delta: -1 | 1) {
    const list = listRef.current!;
    const index = list.findIndex((p) => p.id === id) + delta;
    if (index < 0 || index >= list.length) return;
    setPhrases(moved(list, id, index));
    void commit(id, list);
  }

  const handle = (p: Phrase) => (
    <DragHandle
      label={p.japanese}
      onStart={() => {
        drag.current = { id: p.id, before: listRef.current! };
        setDragging(p.id);
        setError(null);
      }}
      onMove={dragTo}
      onEnd={dragEnd}
      onStep={(delta) => step(p.id, delta)}
    />
  );

  async function remove(p: Phrase) {
    if (!window.confirm(`'${p.japanese}'를 회화 노트에서 지울까요?`)) return;
    try {
      await deletePhrase(p.id);
      setPhrases(listRef.current?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function saved(p: Phrase) {
    setPhrases(listRef.current?.map((x) => (x.id === p.id ? p : x)) ?? null);
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
      {phrases && phrases.length > 1 && <p className="muted small">⠿ 손잡이를 끌어서 순서를 바꿀 수 있어요.</p>}

      {phrases &&
        phrases.length > 0 &&
        (narrow ? (
          <ul className={`item-list${dragging ? ' is-reordering' : ''}`}>
            {phrases.map((p) =>
              editing === p.id ? (
                <li key={p.id} ref={rowRef(p.id)} className="item-row phrase-card phrase-card--editing">
                  <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />
                </li>
              ) : (
                <PhraseCard
                  key={p.id}
                  phrase={p}
                  handle={handle(p)}
                  dragging={dragging === p.id}
                  cardRef={rowRef(p.id)}
                  onEdit={() => setEditing(p.id)}
                  onDelete={() => void remove(p)}
                />
              ),
            )}
          </ul>
        ) : (
          <div className="log-scroll">
            <table className={`log-table phrase-table${dragging ? ' is-reordering' : ''}`}>
              <thead>
                <tr>
                  <th scope="col" className="col-handle" aria-label="순서" />
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
                  <th scope="col" className="col-button" aria-label="듣기" />
                  <th scope="col" className="col-actions" aria-label="수정·삭제" />
                </tr>
              </thead>
              <tbody>
                {phrases.map((p) =>
                  editing === p.id ? (
                    <tr key={p.id} ref={rowRef(p.id)} className="phrase-edit-row">
                      <td colSpan={7}>
                        <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} ref={rowRef(p.id)} className={dragging === p.id ? 'is-dragging' : undefined}>
                      <td className="cell-button">{handle(p)}</td>
                      <td lang="ja" className="log-term">
                        {p.japanese}
                      </td>
                      <td lang="ja">{p.reading}</td>
                      <td>{phraseSound(p)}</td>
                      <td>{p.meaning}</td>
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
                  ),
                )}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
