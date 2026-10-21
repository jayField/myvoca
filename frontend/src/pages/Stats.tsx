import { useEffect, useState } from 'react';
import { api, SERVER_ERROR, type Deck, type Stats as StatsData } from '../api';
import { Heatmap } from '../components/Heatmap';

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.decks()])
      .then(([s, d]) => {
        setStats(s);
        setDecks(d.decks);
      })
      .catch(() => setError(SERVER_ERROR));
  }, []);

  const tiles = stats
    ? [
        { label: '연속 학습', value: `${stats.streak}일` },
        { label: '학습한 항목', value: `${stats.learned}개` },
        { label: '외운 항목', value: `${stats.mastered}개`, hint: '복습 간격 21일 이상' },
        { label: '오늘 푼 카드', value: `${stats.reviews_today}장` },
      ]
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <h1>기록</h1>
      </header>
      {error && <p className="banner-error">{error}</p>}

      {stats && (
        <>
          <div className="tile-grid">
            {tiles.map((t) => (
              <div key={t.label} className="card tile">
                <span className="muted small">{t.label}</span>
                <span className="tile-value">{t.value}</span>
                {t.hint && <span className="muted xsmall">{t.hint}</span>}
              </div>
            ))}
          </div>

          <section className="card card--lg" aria-labelledby="grass-stats">
            <div className="card-head">
              <h2 id="grass-stats" className="card-title">
                학습 잔디
              </h2>
              <span className="muted small">최근 {stats.heatmap.length}일</span>
            </div>
            <Heatmap days={stats.heatmap} />
          </section>

          <section className="card card--lg" aria-labelledby="by-deck">
            <h2 id="by-deck" className="card-title">
              범위별 진도
            </h2>
            <ul className="deck-progress">
              {decks.map((d) => (
                <li key={d.id}>
                  <div className="card-head">
                    <span>{d.title}</span>
                    <span className="muted small">
                      {d.learned} / {d.total}
                    </span>
                  </div>
                  <div className="progress progress--thin">
                    <div className="progress-fill" style={{ width: `${(d.learned / d.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
