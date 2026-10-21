import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, SERVER_ERROR, type Deck, type Item, type Stats, type TodayPlan } from '../api';
import { Heatmap } from '../components/Heatmap';
import { GearIcon } from '../components/Icons';
import { SettingsDialog } from '../components/SettingsDialog';
import { SpeakButton } from '../components/SpeakButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { ORDER_LABEL } from '../labels';

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

  const load = useCallback(async () => {
    try {
      const [plan, deckList, stats, word] = await Promise.all([api.today(), api.decks(), api.stats(), api.wordOfDay()]);
      setData({ plan, decks: deckList.decks, confusing: deckList.confusing, stats, word });
      setError(null);
    } catch {
      setError(SERVER_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="muted small">{today}</div>
          <h1>{data ? greeting(data.plan) : 'ことば帳'}</h1>
        </div>
        <ThemeToggle />
      </header>

      {error && <p className="banner-error">{error}</p>}

      {data && (
        <>
          <div className="row">
            <TodayCard plan={data.plan} onStart={() => navigate('/study')} onSettings={() => setSettingsOpen(true)} />
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

          <div className="row">
            <Link to="/quiz" className="card card--lg quiz-card">
              <span className="card-title">퀴즈</span>
              <span className="muted small">뜻 고르기 · 듣기 · 직접 입력. 끝나면 단어마다 몰랐음 / 헷갈림 / 알았음을 골라요.</span>
              <span className="accent-text link-cta">퀴즈 풀기 →</span>
            </Link>
            <section aria-labelledby="grass" className="card card--lg grass-card">
              <div className="card-head">
                <h2 id="grass" className="card-title">
                  학습 잔디
                </h2>
                <span className="muted small">
                  연속 <strong className="strong">{data.stats.streak}일</strong>
                </span>
              </div>
              <Heatmap days={data.stats.heatmap} />
            </section>
          </div>

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

function TodayCard({ plan, onStart, onSettings }: { plan: TodayPlan; onStart: () => void; onSettings: () => void }) {
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
      <button type="button" className="btn btn--primary btn--lg" onClick={onStart} disabled={nothingLeft}>
        {nothingLeft ? '오늘 학습 완료' : plan.new_done > 0 || plan.reviewed_today > 0 ? '이어서 학습' : '학습 시작'}
      </button>
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
