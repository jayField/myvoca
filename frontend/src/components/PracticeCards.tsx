import { Link } from 'react-router-dom';
import { canSpeak } from '../speech';

export const PRACTICE = [
  { mode: 'meaning', to: '/quiz?mode=meaning', title: '뜻 고르기', description: '단어를 보고 뜻을 골라요' },
  { mode: 'listen', to: '/quiz?mode=listen', title: '듣기', description: '발음을 듣고 단어를 골라요' },
  { mode: 'type', to: '/quiz?mode=type', title: '직접 입력', description: '읽는 법을 직접 써요' },
  { mode: 'speed', to: '/speed', title: '5초 스피드', description: '5초 안에 뜻 맞히기 · 점수 기록', accent: true },
] as const;

/** The quiz menu, shared by the home screen and the quiz page so both always match. */
export function PracticeCards({ deckId }: { deckId?: string | null }) {
  const withDeck = (to: string) => (deckId ? `${to}${to.includes('?') ? '&' : '?'}deck=${encodeURIComponent(deckId)}` : to);
  return (
    <div className="deck-grid">
      {PRACTICE.filter((p) => p.mode !== 'listen' || canSpeak()).map((p) => (
        <Link
          key={p.to}
          to={withDeck(p.to)}
          className={'accent' in p && p.accent ? 'card deck-card deck-card--accent' : 'card deck-card'}
        >
          <span className="deck-title">{p.title}</span>
          <span className="muted small">{p.description}</span>
        </Link>
      ))}
    </div>
  );
}
