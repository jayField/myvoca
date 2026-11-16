import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase } from '../api';
import { DragHandle } from '../components/DragHandle';
import { BackIcon, DownloadIcon } from '../components/Icons';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditor } from '../components/PhraseEditor';
import { deletePhrase, listPhrases, placeAt, savePositions, TALK_DECK } from '../lib/phrases';

const PHONE = '(max-width: 760px)';
/** How close to the window's top or bottom edge a drag scrolls the page, and how far per move. */
const SCROLL_EDGE = 72;
const SCROLL_STEP = 14;
/** How blocks slide out of the way, and how a dropped block settles into its place. */
const SLIDE = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';

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

/** 회화 노트 as a deck: everything saved so far, as blocks in the learner's own order. Adding happens on /talk. */
export default function PhraseDeck() {
  const [phrases, setPhrasesState] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const narrow = useNarrow();
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

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
    el.style.transform = `translateY(${d.y - d.grab - natural}px)`;
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

  function dragStart(id: string, clientY: number) {
    const el = blocks.current.get(id);
    const list = listEl.current;
    if (!el || !list || !listRef.current) return;
    el.style.transition = 'none';
    drag.current = { id, before: listRef.current, grab: clientY - (list.getBoundingClientRect().top + el.offsetTop), y: clientY };
    setDragging(id);
    setError(null);
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

  function dragEnd() {
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

  function step(id: string, delta: -1 | 1) {
    const list = listRef.current!;
    const index = list.findIndex((p) => p.id === id) + delta;
    if (index < 0 || index >= list.length) return;
    reorder(moved(list, id, index));
    void commit(id, list);
  }

  const handle = (p: Phrase) => (
    <DragHandle
      label={p.japanese}
      onStart={(y) => dragStart(p.id, y)}
      onMove={dragTo}
      onEnd={dragEnd}
      onStep={(delta) => step(p.id, delta)}
    />
  );

  async function remove(p: Phrase) {
    if (!window.confirm(`'${p.japanese}'를 회화 노트에서 지울까요?`)) return;
    try {
      await deletePhrase(p.id);
      reorder(listRef.current?.filter((x) => x.id !== p.id) ?? []);
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
      {phrases && phrases.length > 1 && <p className="muted small">⠿ 손잡이를 잡고 끌면 블록 순서를 바꿀 수 있어요.</p>}

      {phrases && phrases.length > 0 && (
        <ul ref={listEl} className={`phrase-blocks${dragging ? ' is-reordering' : ''}`}>
          {phrases.map((p) =>
            editing === p.id ? (
              <li key={p.id} ref={blockRef(p.id)} className="phrase-block phrase-block--editing">
                <PhraseEditor phrase={p} onSaved={saved} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <PhraseCard
                key={p.id}
                phrase={p}
                handle={handle(p)}
                dragging={dragging === p.id}
                cardRef={blockRef(p.id)}
                onEdit={() => setEditing(p.id)}
                onDelete={() => void remove(p)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
