import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck, type Grade, type Item, type Stats, type TodayPlan } from '../api';
import { useDataVersion } from '../auth';
import { Heatmap } from '../components/Heatmap';
import { PracticeCards } from '../components/PracticeCards';
import { GearIcon, UserIcon } from '../components/Icons';
import { SettingsDialog } from '../components/SettingsDialog';
import { SpeakButton } from '../components/SpeakButton';
import { showsReading, Term } from '../components/Term';
import { ThemeToggle } from '../components/ThemeToggle';
import { ORDER_LABEL } from '../labels';

interface HomeData {
  plan: TodayPlan;
  decks: Deck[];
  confusing: number;
  stats: Stats;
  word: Item;
  results: Record<Grade, number>;
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
      const [plan, deckList, stats, word, results] = await Promise.all([
        api.today(),
        api.decks(),
        api.stats(),
        api.wordOfDay(),
        api.todayResults(),
      ]);
      setData({ plan, decks: deckList.decks, confusing: deckList.confusing, stats, word, results });
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
      `${plan.deck_title} 학습 기록을 지우고 처음부터 다시 할까요?\n복습 일정이 사라지고 되돌릴 수 없어요. 헷갈리는 단어 목록은 그대로 남아요.`,
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

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

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
              results={data.results}
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
            <PracticeCards />
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
  results: Record<Grade, number>;
  deckLearned: number;
  resetting: boolean;
  onStart: () => void;
  onSettings: () => void;
  onReset: () => void;
}

function TodayCard({ plan, results, deckLearned, resetting, onStart, onSettings, onReset }: TodayCardProps) {
  const studied = results.good + results.hard + results.again;
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
      {studied > 0 && (
        <p className="muted small">
          오늘 {studied}장 · 알았음 {results.good} · 헷갈림 {results.hard} · 몰랐음 {results.again}
        </p>
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
        <Term item={word} className="word-term" />
        <div>
          {showsReading(word) && (
            <div lang="ja" className="word-reading">
              {word.reading}
            </div>
          )}
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
