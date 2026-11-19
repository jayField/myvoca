import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { BackIcon, CloseIcon, DownloadIcon, EditIcon, GripIcon, SearchIcon } from '../components/Icons';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditor } from '../components/PhraseEditor';
import { SpeakButton } from '../components/SpeakButton';
import { deletePhrase, listPhrases, matchesSearch, phraseSound, placeAt, savePositions, TALK_DECK } from '../lib/phrases';

const PHONE = '(max-width: 760px)';
/** How close to the window's top or bottom edge a drag scrolls the page, and how far per move. */
const SCROLL_EDGE = 72;
const SCROLL_STEP = 14;
/** How blocks slide out of the way, and how a dropped block settles into its place. */
const SLIDE = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
/** The picked-up block grows a little, so it reads as lifted. */
const LIFT = 'scale(1.02)';

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

/**
 * 회화 노트 as a deck: a table (cards on phones) of everything saved so far. 순서 바꾸기 swaps it for plain
 * blocks that can be picked up anywhere and dragged into place. Adding happens on /talk.
 */
export default function PhraseDeck() {
  const [phrases, setPhrasesState] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const narrow = useNarrow();
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  /** The search box: null while closed. */
  const [query, setQuery] = useState<string | null>(null);

  // Pointer handlers read these directly, so a move right after pressing never sees a stale render.
  const listRef = useRef<Phrase[] | null>(null);
  const listEl = useRef<HTMLUListElement>(null);
  const blocks = useRef(new Map<string, HTMLElement>());
  /** The block being dragged: where it was grabbed (from its top) and where the pointer is now. */
  const drag = useRef<{ id: string; before: Phrase[]; grab: number; y: number } | null>(null);
  /** Where each block sat before the last reorder, so it can slide from there to its new place. */
  const slideFrom = useRef<Map<string, number> | null>(null);

  function setPhrases(next: Phrase[] | null) {
    listRef.current = next;
    setPhrasesState(next);
  }

  /** Reorder with the other blocks sliding into their new places rather than jumping. */
  function reorder(next: Phrase[]) {
    slideFrom.current = new Map([...blocks.current].map(([id, el]) => [id, el.offsetTop]));
    setPhrases(next);
  }

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch((e: Error) => setError(e.message));
  }, []);

  const blockRef = (id: string) => (el: HTMLElement | null) => {
    if (el) blocks.current.set(id, el);
    else blocks.current.delete(id);
  };

  /** Keeps the dragged block under the pointer wherever the list has put it. */
  function follow() {
    const d = drag.current;
    const el = d && blocks.current.get(d.id);
    const list = listEl.current;
    if (!d || !el || !list) return;
    const natural = list.getBoundingClientRect().top + el.offsetTop;
    el.style.transform = `translateY(${d.y - d.grab - natural}px) ${LIFT}`;
  }

  useLayoutEffect(() => {
    const from = slideFrom.current;
    slideFrom.current = null;
    if (from) {
      for (const [id, el] of blocks.current) {
        const old = from.get(id);
        if (old === undefined || id === drag.current?.id) continue;
        const delta = old - el.offsetTop;
        if (!delta) continue;
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        void el.offsetHeight; // apply the jump back before sliding forward
        el.style.transition = SLIDE;
        el.style.transform = '';
      }
    }
    follow();
  }, [phrases]);

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
      reorder(before);
      setError((e as Error).message);
    }
  }

  function pickUp(e: PointerEvent<HTMLLIElement>, id: string) {
    const el = blocks.current.get(id);
    const list = listEl.current;
    if (e.button !== 0 || !el || !list || !listRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    el.style.transition = 'none';
    drag.current = { id, before: listRef.current, grab: e.clientY - (list.getBoundingClientRect().top + el.offsetTop), y: e.clientY };
    setDragging(id);
    setError(null);
    follow();
  }

  function dragTo(clientY: number) {
    const d = drag.current;
    const list = listRef.current;
    const el = d && blocks.current.get(d.id);
    const box = listEl.current?.getBoundingClientRect();
    if (!d || !list || !el || !box) return;
    d.y = clientY;
    if (clientY < SCROLL_EDGE) window.scrollBy(0, -SCROLL_STEP);
    else if (clientY > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, SCROLL_STEP);
    // The dragged block goes after every other block whose middle is above its own middle.
    const middle = clientY - d.grab + el.offsetHeight / 2;
    const index = list.filter((p) => {
      const other = p.id !== d.id && blocks.current.get(p.id);
      return other ? box.top + other.offsetTop + other.offsetHeight / 2 < middle : false;
    }).length;
    if (list[index]?.id !== d.id) reorder(moved(list, d.id, index));
    else follow();
  }

  function drop() {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d) return;
    const el = blocks.current.get(d.id);
    if (el) {
      el.style.transition = SLIDE;
      el.style.transform = '';
    }
    void commit(d.id, d.before);
  }

  function step(e: KeyboardEvent<HTMLLIElement>, id: string) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const list = listRef.current!;
    const index = list.findIndex((p) => p.id === id) + (e.key === 'ArrowUp' ? -1 : 1);
    if (index < 0 || index >= list.length) return;
    reorder(moved(list, id, index));
    void commit(id, list);
  }

  function toggleReordering() {
    blocks.current.clear();
    setEditing(null);
    setQuery(null);
    setReordering(!reordering);
  }

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

  const searching = query !== null && query.trim() !== '';
  const shown = phrases && searching ? phrases.filter((p) => matchesSearch(p, query)) : phrases;

  const editor = (p: Phrase) => <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />;

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
            {phrases && (searching ? ` · ${phrases.length}개 중 ${shown!.length}개` : ` · ${phrases.length}개`)}
          </p>
        </div>
        {reordering ? (
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={toggleReordering}>
              완료
            </button>
          </div>
        ) : (
          <div className="button-row">
            <Link to="/talk" className="btn btn--primary">
              {narrow ? '추가' : '표현 추가'}
            </Link>
            <button type="button" className="btn btn--ghost" onClick={toggleReordering} disabled={!phrases || phrases.length < 2}>
              {narrow ? '순서' : '순서 바꾸기'}
            </button>
            <Link to={`/quiz?deck=${TALK_DECK.id}`} className="btn btn--ghost">
              {narrow ? '퀴즈' : '이 범위로 퀴즈'}
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => void exportPdf()} disabled={!phrases?.length || exporting}>
              {!narrow && <DownloadIcon />}
              {exporting ? '만드는 중…' : narrow ? 'PDF' : 'PDF 다운로드'}
            </button>
            <button
              type="button"
              className={`btn ${query !== null ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={query !== null}
              onClick={() => setQuery(query === null ? '' : null)}
              disabled={!phrases?.length}
            >
              {!narrow && <SearchIcon />}
              검색
            </button>
          </div>
        )}
      </header>

      {query !== null && !reordering && (
        <div className="phrase-search">
          <SearchIcon />
          <input
            type="search"
            className="text-input text-input--block"
            placeholder="예: 대답, 닥쳐 (쉼표로 여러 개)"
            aria-label="회화 노트 검색"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery(null)}
          />
          <button type="button" className="icon-btn" aria-label="검색 닫기" title="닫기" onClick={() => setQuery(null)}>
            <CloseIcon />
          </button>
        </div>
      )}

      {error && <p className="banner-error">{error}</p>}
      {searching && shown?.length === 0 && <p className="muted">'{query.trim()}'에 맞는 표현이 없어요.</p>}
      {phrases && phrases.length === 0 && (
        <p className="muted">
          아직 저장한 표현이 없어요. <Link to="/talk">표현 추가</Link>에서 번역해서 저장해 보세요.
        </p>
      )}

      {phrases && phrases.length > 0 && reordering && (
        <>
          <p className="muted small">블록을 잡고 위아래로 끌어 옮겨요. 다 옮겼으면 완료를 눌러 주세요.</p>
          <ul ref={listEl} className={`reorder-blocks${dragging ? ' is-reordering' : ''}`}>
            {phrases.map((p) => (
              <li
                key={p.id}
                ref={blockRef(p.id)}
                className={`reorder-block${dragging === p.id ? ' is-dragging' : ''}`}
                tabIndex={0}
                aria-label={`${p.japanese} ${p.meaning}. 위아래 화살표로 옮겨요`}
                onPointerDown={(e) => pickUp(e, p.id)}
                onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && dragTo(e.clientY)}
                onPointerUp={drop}
                onPointerCancel={drop}
                onKeyDown={(e) => step(e, p.id)}
              >
                <span className="reorder-grip" aria-hidden="true">
                  <GripIcon />
                </span>
                <span lang="ja" className="reorder-term">
                  {p.japanese}
                </span>
                <span className="reorder-meaning">{p.meaning}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {shown && shown.length > 0 && !reordering && narrow && (
        <ul className="phrase-blocks">
          {shown.map((p) =>
            editing === p.id ? (
              <li key={p.id} className="phrase-block phrase-block--editing">
                {editor(p)}
              </li>
            ) : (
              <PhraseCard key={p.id} phrase={p} onEdit={() => setEditing(p.id)} onDelete={() => void remove(p)} />
            ),
          )}
        </ul>
      )}

      {shown && shown.length > 0 && !reordering && !narrow && (
        <div className="log-scroll">
          <table className="log-table phrase-table">
            <thead>
              <tr>
                <th scope="col" className="col-term">
                  표현
                </th>
                <th scope="col" className="col-reading">
                  읽기
                </th>
                <th scope="col" className="col-sound">
                  발음
                </th>
                <th scope="col">뜻</th>
                <th scope="col" className="col-button" aria-label="듣기" />
                <th scope="col" className="col-actions" aria-label="수정·삭제" />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="phrase-edit-row">
                    <td colSpan={6}>{editor(p)}</td>
                  </tr>
                ) : (
                  <tr key={p.id}>
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
                        <button type="button" className="icon-btn" aria-label={`${p.japanese} 수정`} title="수정" onClick={() => setEditing(p.id)}>
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
      )}
    </div>
  );
}
