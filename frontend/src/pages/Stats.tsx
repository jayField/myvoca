import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataVersion } from '../auth';
import { api, LOAD_ERROR, type Deck, type Stats as StatsData } from '../api';
import { Heatmap } from '../components/Heatmap';
import { localDate } from '../lib/dates';

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api.stats(), api.decks()])
      .then(([s, d]) => {
        setStats(s);
        setDecks(d.decks);
      })
      .catch(() => setError(LOAD_ERROR));
  }, []);

  const dataVersion = useDataVersion();
  useEffect(load, [load, dataVersion]);

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

          <Backup onImported={load} />
        </>
      )}
    </div>
  );
}

function Backup({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function exportFile() {
    try {
      const url = URL.createObjectURL(await api.exportBackup());
      const a = document.createElement('a');
      a.href = url;
      a.download = `tango-note-backup-${localDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ text: '백업 파일을 저장했어요.', ok: true });
    } catch {
      setMessage({ text: '백업 파일을 만들지 못했어요.', ok: false });
    }
  }

  async function importFile(file: File) {
    if (!window.confirm('지금 이 브라우저의 학습 기록을 백업 파일 내용으로 바꿀까요? 되돌릴 수 없어요.')) return;
    try {
      const count = await api.importBackup(await file.text());
      setMessage({ text: `백업에서 ${count}개 항목의 기록을 가져왔어요.`, ok: true });
      onImported();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : '가져오지 못했어요.', ok: false });
    }
  }

  return (
    <section className="card card--lg stack-sm" aria-labelledby="backup">
      <h2 id="backup" className="card-title">
        백업
      </h2>
      <p className="muted small">
        학습 기록은 이 브라우저에만 저장돼요. 다른 기기로 옮기거나 브라우저 데이터를 지우기 전에 파일로 내보내 두세요.
      </p>
      <div className="button-row">
        <button type="button" className="btn btn--ghost" onClick={() => void exportFile()}>
          내보내기
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
      {message && <p className={message.ok ? 'success-text small' : 'error-text'}>{message.text}</p>}
    </section>
  );
}
