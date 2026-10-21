import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck, type Item, type Stats, type TodayPlan } from '../api';
import { useDataVersion } from '../auth';
import { Heatmap } from '../components/Heatmap';
import { GearIcon, UserIcon } from '../components/Icons';
import { SettingsDialog } from '../components/SettingsDialog';
import { SpeakButton } from '../components/SpeakButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { ORDER_LABEL } from '../labels';

const PRACTICE = [
  { to: '/quiz?mode=meaning', title: '뜻 고르기', description: '단어를 보고 뜻을 골라요' },
  { to: '/quiz?mode=listen', title: '듣기', description: '발음을 듣고 단어를 골라요' },
  { to: '/quiz?mode=type', title: '직접 입력', description: '읽는 법을 직접 써요' },
  { to: '/speed', title: '5초 스피드', description: '5초 안에 뜻 맞히기 · 점수 기록', accent: true },
];

interface HomeData {
  plan: TodayPlan;
  decks: Deck[];
  confusing: number;
  stats: Stats;
  word: Item;
}

function greeting(plan: TodayPlan): string {
  if (plan.reviews.length > 0) return '다시 오셨네요. 복습부터 시작해요.';
  if (plan.new_items.length > 0) return '오늘의 새 단어를 익혀볼까요?';
  return '오늘 목표를 모두 채웠어요.';
}

export default function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plan, deckList, stats, word] = await Promise.all([api.today(), api.decks(), api.stats(), api.wordOfDay()]);
      setData({ plan, decks: deckList.decks, confusing: deckList.confusing, stats, word });
      setError(null);
    } catch {
      setError(LOAD_ERROR);
    }
  }, []);

  const dataVersion = useDataVersion();
  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  async function resetTodayDeck(plan: TodayPlan) {
    const ok = window.confirm(
      `${plan.deck_title} 학습 기록을 지우고 처음부터 다시 할까요?\n복습 일정과 헷갈리는 단어 표시도 사라지고 되돌릴 수 없어요.`,
    );
    if (!ok) return;
    setResetting(true);
    try {
      await api.resetDeck(plan.settings.deck_id);
      await load();
    } catch {
      setError('초기화하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setResetting(false);
    }
  }

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="muted small">{today}</div>
          <h1>{data ? greeting(data.plan) : '単語ノート'}</h1>
        </div>
        <div className="header-actions">
          <Link to="/account" className="icon-btn icon-btn--framed mobile-only" aria-label="계정">
            <UserIcon />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}

      {data && (
        <>
          <div className="row">
            <TodayCard
              plan={data.plan}
              deckLearned={data.decks.find((d) => d.id === data.plan.settings.deck_id)?.learned ?? 0}
              resetting={resetting}
              onStart={() => navigate('/study')}
              onSettings={() => setSettingsOpen(true)}
              onReset={() => void resetTodayDeck(data.plan)}
            />
            <WordOfDay word={data.word} />
          </div>

          <section aria-labelledby="books">
            <h2 id="books" className="section-title">
              단어장
            </h2>
            <div className="deck-grid">
              {data.decks.map((deck) => (
                <Link key={deck.id} to={`/decks/${deck.id}`} className="card deck-card">
                  <span className="deck-title">{deck.title}</span>
                  <span className="muted small">
                    {deck.total}개 중 {deck.learned}개 학습
                    {deck.due > 0 && ` · 복습 ${deck.due}`}
                  </span>
                </Link>
              ))}
              <Link to={`/decks/${CONFUSING_DECK_ID}`} className="card deck-card deck-card--danger">
                <span className="deck-title">
                  헷갈리는 단어 <span className="danger-text">{data.confusing}</span>
                </span>
                <span className="muted small">몰랐음·헷갈림 자동 모음</span>
              </Link>
            </div>
          </section>

          <section aria-labelledby="practice">
            <h2 id="practice" className="section-title">
              퀴즈
            </h2>
            <div className="deck-grid">
              {PRACTICE.map((p) => (
                <Link key={p.to} to={p.to} className={p.accent ? 'card deck-card deck-card--accent' : 'card deck-card'}>
                  <span className="deck-title">{p.title}</span>
                  <span className="muted small">{p.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="grass" className="card card--lg">
            <div className="card-head grass-head">
              <h2 id="grass" className="card-title">
                학습 잔디
              </h2>
              <span className="muted small">
                연속 <strong className="strong">{data.stats.streak}일</strong>
              </span>
            </div>
            <Heatmap days={data.stats.heatmap} />
          </section>

          <SettingsDialog
            open={settingsOpen}
            decks={data.decks}
            settings={data.plan.settings}
            onClose={() => setSettingsOpen(false)}
            onSaved={() => {
              setSettingsOpen(false);
              void load();
            }}
          />
        </>
      )}
    </div>
  );
}

interface TodayCardProps {
  plan: TodayPlan;
  deckLearned: number;
  resetting: boolean;
  onStart: () => void;
  onSettings: () => void;
  onReset: () => void;
}

function TodayCard({ plan, deckLearned, resetting, onStart, onSettings, onReset }: TodayCardProps) {
  const target = plan.settings.daily_new;
  const percent = Math.min(100, Math.round((plan.new_done / target) * 100));
  const nothingLeft = plan.reviews.length === 0 && plan.new_items.length === 0;
  return (
    <section className="card card--hero today-card" aria-labelledby="today-title">
      <div className="card-head">
        <h2 id="today-title" className="card-title card-title--lg">
          오늘의 학습
        </h2>
        <button type="button" className="setting-pill" onClick={onSettings}>
          {plan.deck_title} · {ORDER_LABEL[plan.settings.order]}
          <GearIcon />
        </button>
      </div>
      <div className="today-numbers">
        <div>
          <div className="muted small">복습</div>
          <div className="big-number accent-text">{plan.reviews.length}</div>
        </div>
        <div>
          <div className="muted small">새 단어</div>
          <div className="big-number">
            {plan.new_done}
            <span className="big-number-sub"> / {target}</span>
          </div>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-label="오늘의 새 단어 진행률" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {plan.deck_unlearned === 0 && plan.new_items.length === 0 && (
        <p className="muted small">{plan.deck_title} 범위를 모두 시작했어요. 설정에서 다음 범위를 골라 보세요.</p>
      )}
      <div className="button-row">
        <button type="button" className="btn btn--primary btn--lg" onClick={onStart} disabled={nothingLeft}>
          {nothingLeft ? '오늘 학습 완료' : plan.new_done > 0 || plan.reviewed_today > 0 ? '이어서 학습' : '학습 시작'}
        </button>
        <button
          type="button"
          className="btn btn--danger btn--lg"
          onClick={onReset}
          disabled={resetting || deckLearned === 0}
          title={`${plan.deck_title} 학습 기록 초기화`}
        >
          {resetting ? '초기화 중…' : '초기화'}
        </button>
      </div>
    </section>
  );
}

function WordOfDay({ word }: { word: Item }) {
  return (
    <aside aria-label="오늘의 한 단어" className="card word-card">
      <div className="card-head">
        <span className="muted small">오늘의 한 단어</span>
        <SpeakButton text={word.term} />
      </div>
      <div className="word-main">
        <span lang="ja" className="word-term">
          {word.term}
        </span>
        <div>
          <div lang="ja" className="word-reading">
            {word.reading}
          </div>
          <div className="muted">{word.meaning}</div>
        </div>
      </div>
      {word.example_ja && (
        <p className="muted small word-example">
          <span lang="ja" className="strong">
            {word.example_ja}
          </span>{' '}
          {word.example_ko}
        </p>
      )}
    </aside>
  );
}
