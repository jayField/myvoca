import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDataVersion } from '../auth';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type DeckItem } from '../api';
import { BackIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { STATUS_LABEL } from '../labels';
import { addDays, localDate } from '../lib/dates';

export default function DeckDetail() {
  const { deckId = '' } = useParams();
  const [deck, setDeck] = useState<{ title: string; description: string } | null>(null);
  const [items, setItems] = useState<DeckItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [resetting, setResetting] = useState(false);

  const dataVersion = useDataVersion();
  useEffect(() => {
    api
      .deckItems(deckId)
      .then((res) => {
        setDeck(res.deck);
        setItems(res.items);
        setError(null);
      })
      // IndexedDB failures surface as DOMException; our own errors (e.g. unknown deck) carry their message.
      .catch((e) => setError(e instanceof DOMException || !(e instanceof Error) ? LOAD_ERROR : e.message));
  }, [deckId, dataVersion, reload]);

  async function resetDeck() {
    if (!deck) return;
    const ok = window.confirm(
      `${deck.title}의 학습 기록을 모두 지울까요?\n복습 일정과 헷갈리는 단어 표시도 사라지고 되돌릴 수 없어요.`,
    );
    if (!ok) return;
    setResetting(true);
    try {
      await api.resetDeck(deckId);
      setReload((n) => n + 1);
    } catch {
      setError('초기화하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setResetting(false);
    }
  }

  const learnedCount = items.filter((item) => item.status !== 'new').length;

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
        <div className="button-row">
          <Link to={`/quiz?deck=${deckId}`} className="btn btn--ghost">
            이 범위로 퀴즈
          </Link>
          {deckId !== CONFUSING_DECK_ID && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void resetDeck()}
              disabled={resetting || learnedCount === 0}
            >
              {resetting ? '초기화 중…' : '기록 초기화'}
            </button>
          )}
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {deck && items.length === 0 && <p className="muted">아직 모인 단어가 없어요.</p>}

      {deckId === CONFUSING_DECK_ID ? (
        groupByDay(items).map(([day, group]) => (
          <section key={day} aria-labelledby={`day-${day}`} className="stack-sm">
            <h2 id={`day-${day}`} className="section-title day-title">
              {dayLabel(day)} <span className="muted small">· {group.length}개</span>
            </h2>
            <ItemList items={group} />
          </section>
        ))
      ) : (
        <ItemList items={items} />
      )}
    </div>
  );
}

function groupByDay(items: DeckItem[]): [string, DeckItem[]][] {
  const groups = new Map<string, DeckItem[]>();
  for (const item of items) {
    const day = item.missed_day ?? '';
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()];
}

function dayLabel(day: string): string {
  if (!day) return '날짜 없음';
  const today = localDate();
  const label = new Date(`${day}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  if (day === today) return `${label} (오늘)`;
  if (day === addDays(today, -1)) return `${label} (어제)`;
  return label;
}

function ItemList({ items }: { items: DeckItem[] }) {
  return (
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
  );
}
