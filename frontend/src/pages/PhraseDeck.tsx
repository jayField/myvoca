import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Phrase, PhraseGroup } from '../api';
import { BackIcon, CloseIcon, DownloadIcon, EditIcon, GripIcon, SearchIcon } from '../components/Icons';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditor } from '../components/PhraseEditor';
import { SpeakButton } from '../components/SpeakButton';
import {
  createGroup,
  deleteGroup,
  deletePhrase,
  groupName,
  inGroup,
  listGroups,
  listPhrases,
  matchesSearch,
  mergeOrder,
  movePhrases,
  phraseSound,
  placeAt,
  renameGroup,
  savePositions,
  TALK_DECK,
  type GroupView,
} from '../lib/phrases';

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
 * 회화 노트 as a deck: a table (cards on phones) of everything saved so far. Group chips on top narrow it to
 * one of the learner's groups or 미분류; 선택 ticks phrases to put in a group together. 순서 바꾸기 swaps the
 * list for plain blocks that can be picked up anywhere and dragged into place, within the open group.
 * Adding happens on /talk.
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
  const [groups, setGroups] = useState<PhraseGroup[]>([]);
  // The open group lives in the address, so coming back from adding a phrase lands in the same group.
  const [params, setParams] = useSearchParams();
  const asked = params.get('group');
  const view: GroupView = asked === 'none' || groups.some((g) => g.id === asked) ? asked! : 'all';
  const viewRef = useRef<GroupView>(view);
  viewRef.current = view;
  /** 선택 mode: the ticked phrases, or null when not selecting. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [moving, setMoving] = useState(false);

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

  /** The phrases of the open group, in order: what 순서 바꾸기 moves around. */
  function viewList(): Phrase[] {
    return (listRef.current ?? []).filter((p) => inGroup(p, viewRef.current));
  }

  /** Reorder the open group's phrases, the other blocks sliding into their new places rather than jumping. */
  function reorder(next: Phrase[]) {
    slideFrom.current = new Map([...blocks.current].map(([id, el]) => [id, el.offsetTop]));
    setPhrases(mergeOrder(listRef.current ?? [], next, viewRef.current));
  }

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch((e: Error) => setError(e.message));
    listGroups()
      .then(setGroups)
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
    const list = viewList();
    const index = list.findIndex((p) => p.id === id);
    if (before[index]?.id === id) return;
    const updates = placeAt(list, index);
    const position = new Map(updates.map((u) => [u.id, u.position]));
    setPhrases(listRef.current!.map((p) => (position.has(p.id) ? { ...p, position: position.get(p.id)! } : p)));
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
    drag.current = { id, before: viewList(), grab: e.clientY - (list.getBoundingClientRect().top + el.offsetTop), y: e.clientY };
    setDragging(id);
    setError(null);
    follow();
  }

  function dragTo(clientY: number) {
    const d = drag.current;
    const list = viewList();
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
    const list = viewList();
    const index = list.findIndex((p) => p.id === id) + (e.key === 'ArrowUp' ? -1 : 1);
    if (index < 0 || index >= list.length) return;
    reorder(moved(list, id, index));
    void commit(id, list);
  }

  function toggleReordering() {
    blocks.current.clear();
    setEditing(null);
    setQuery(null);
    setSelected(null);
    setReordering(!reordering);
  }

  function openGroup(next: GroupView) {
    setEditing(null);
    setSelected(null);
    setParams(next === 'all' ? {} : { group: next }, { replace: true });
  }

  /** Asks for a name and makes the group; returns it, or null when cancelled or it failed. */
  async function newGroup(): Promise<PhraseGroup | null> {
    const name = groupName(window.prompt('새 그룹 이름 (예: 식당, 여행, 인사)'));
    if (!name) return null;
    try {
      const group = await createGroup(name);
      setGroups((list) => [...list, group]);
      setError(null);
      return group;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }

  async function addGroup() {
    const group = await newGroup();
    if (group) openGroup(group.id);
  }

  async function renameOpenGroup(group: PhraseGroup) {
    const name = groupName(window.prompt('그룹 이름 바꾸기', group.name));
    if (!name || name === group.name) return;
    try {
      await renameGroup(group.id, name);
      setGroups((list) => list.map((g) => (g.id === group.id ? { ...g, name } : g)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteOpenGroup(group: PhraseGroup) {
    const count = phrases?.filter((p) => p.group_id === group.id).length ?? 0;
    const ok = window.confirm(
      `'${group.name}' 그룹을 지울까요?${count ? `\n안에 있던 표현 ${count}개는 지워지지 않고 미분류로 돌아가요.` : ''}`,
    );
    if (!ok) return;
    try {
      await deleteGroup(group.id);
      setGroups((list) => list.filter((g) => g.id !== group.id));
      setPhrases(listRef.current?.map((p) => (p.group_id === group.id ? { ...p, group_id: null } : p)) ?? null);
      openGroup('all');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function toggleSelecting() {
    setEditing(null);
    setSelected(selected ? null : new Set());
  }

  function toggle(id: string) {
    if (!selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  /** Puts the ticked phrases in a group ('' = 미분류, 'new' = a group made on the spot). */
  async function moveSelected(target: string) {
    if (!selected?.size) return;
    let groupId: string | null = target || null;
    if (target === 'new') {
      const group = await newGroup();
      if (!group) return;
      groupId = group.id;
    }
    const ids = [...selected];
    setMoving(true);
    try {
      await movePhrases(ids, groupId);
      const moved = new Set(ids);
      setPhrases(listRef.current?.map((p) => (moved.has(p.id) ? { ...p, group_id: groupId } : p)) ?? null);
      setSelected(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoving(false);
    }
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
    if (!inView?.length) return;
    setExporting(true);
    setError(null);
    try {
      const { downloadPhrasesPdf } = await import('../lib/phrasePdf');
      await downloadPhrasesPdf(inView);
    } catch {
      setError('PDF를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setExporting(false);
    }
  }

  const inView = phrases?.filter((p) => inGroup(p, view)) ?? null;
  const searching = query !== null && query.trim() !== '';
  const shown = inView && searching ? inView.filter((p) => matchesSearch(p, query)) : inView;
  const openGroupInfo = groups.find((g) => g.id === view);
  const countIn = (v: GroupView) => phrases?.filter((p) => inGroup(p, v)).length ?? 0;
  const allShownSelected = !!selected && !!shown?.length && shown.every((p) => selected.has(p.id));

  const editor = (p: Phrase) => <PhraseEditor phrase={p} groups={groups} onSaved={saved} onCancel={() => setEditing(null)} />;

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
            {inView && (searching ? ` · ${inView.length}개 중 ${shown!.length}개` : ` · ${inView.length}개`)}
          </p>
        </div>
        {reordering || selected ? (
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={reordering ? toggleReordering : toggleSelecting}>
              {reordering ? '완료' : '선택 끝내기'}
            </button>
          </div>
        ) : (
          <div className="button-row">
            <Link to={openGroupInfo ? `/talk?group=${openGroupInfo.id}` : '/talk'} className="btn btn--primary">
              {narrow ? '추가' : '표현 추가'}
            </Link>
            <button type="button" className="btn btn--ghost" onClick={toggleSelecting} disabled={!inView?.length}>
              선택
            </button>
            <button type="button" className="btn btn--ghost" onClick={toggleReordering} disabled={!inView || inView.length < 2}>
              {narrow ? '순서' : '순서 바꾸기'}
            </button>
            <Link to={`/quiz?deck=${TALK_DECK.id}`} className="btn btn--ghost">
              {narrow ? '퀴즈' : '이 범위로 퀴즈'}
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => void exportPdf()} disabled={!inView?.length || exporting}>
              {!narrow && <DownloadIcon />}
              {exporting ? '만드는 중…' : narrow ? 'PDF' : 'PDF 다운로드'}
            </button>
            <button
              type="button"
              className={`btn ${query !== null ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={query !== null}
              onClick={() => setQuery(query === null ? '' : null)}
              disabled={!inView?.length}
            >
              {!narrow && <SearchIcon />}
              검색
            </button>
          </div>
        )}
      </header>

      {phrases && !reordering && (
        <div className="group-bar">
          <div className="group-chips" role="group" aria-label="그룹">
            {[
              { id: 'all', name: '전체' },
              ...groups,
              ...(groups.length ? [{ id: 'none', name: '미분류' }] : []),
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                className={`group-chip${view === g.id ? ' is-active' : ''}`}
                aria-pressed={view === g.id}
                onClick={() => openGroup(g.id)}
              >
                {g.name} <span className="group-chip-count">{countIn(g.id)}</span>
              </button>
            ))}
            <button type="button" className="group-chip group-chip--add" onClick={() => void addGroup()}>
              + 그룹
            </button>
          </div>
          {openGroupInfo && !selected && (
            <p className="group-tools muted small">
              <button type="button" className="link-btn" onClick={() => void renameOpenGroup(openGroupInfo)}>
                이름 바꾸기
              </button>
              <button type="button" className="link-btn danger-text" onClick={() => void deleteOpenGroup(openGroupInfo)}>
                그룹 삭제
              </button>
            </p>
          )}
        </div>
      )}

      {selected && (
        <div className="select-bar">
          <span className="strong">{selected.size}개 선택</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setSelected(allShownSelected ? new Set() : new Set(shown?.map((p) => p.id)))}
            disabled={!shown?.length}
          >
            {allShownSelected ? '선택 해제' : searching ? '검색 결과 전체 선택' : '전체 선택'}
          </button>
          <select
            className="text-input select-bar-move"
            aria-label="고른 표현을 넣을 그룹"
            value=""
            disabled={!selected.size || moving}
            onChange={(e) => void moveSelected(e.target.value === 'none' ? '' : e.target.value)}
          >
            <option value="" disabled>
              {moving ? '넣는 중…' : '그룹에 넣기'}
            </option>
            {groups
              .filter((g) => g.id !== view)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            {view !== 'none' && groups.length > 0 && <option value="none">미분류로 빼기</option>}
            <option value="new">+ 새 그룹 만들기</option>
          </select>
        </div>
      )}

      {query !== null && !reordering && (
        <div className="phrase-search">
          <SearchIcon />
          <input
            type="search"
            className="text-input text-input--block"
            placeholder="예: 안녕하세요, 반갑습니다"
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
      {!searching && phrases && phrases.length > 0 && inView?.length === 0 && (
        <p className="muted">
          {view === 'none' ? '미분류 표현이 없어요. 모두 그룹에 들어갔어요.' : '이 그룹은 비어 있어요. 전체에서 선택을 눌러 표현을 넣어 보세요.'}
        </p>
      )}
      {phrases && phrases.length === 0 && (
        <p className="muted">
          아직 저장한 표현이 없어요. <Link to="/talk">표현 추가</Link>에서 번역해서 저장해 보세요.
        </p>
      )}

      {inView && inView.length > 0 && reordering && (
        <>
          <p className="muted small">블록을 잡고 위아래로 끌어 옮겨요. 다 옮겼으면 완료를 눌러 주세요.</p>
          <ul ref={listEl} className={`reorder-blocks${dragging ? ' is-reordering' : ''}`}>
            {inView.map((p) => (
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

      {shown && shown.length > 0 && selected && (
        <ul className="phrase-blocks">
          {shown.map((p) => (
            <PhraseCard key={p.id} phrase={p} onDelete={() => {}} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </ul>
      )}

      {shown && shown.length > 0 && !reordering && !selected && narrow && (
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

      {shown && shown.length > 0 && !reordering && !selected && !narrow && (
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
