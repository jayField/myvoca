import { useState } from 'react';
import { useAuth } from '../auth';
import { displayName } from '../lib/username';
import { VOICE_CREDIT } from '../speech';

function syncLabel(syncing: boolean, error: string | null, lastSynced: Date | null): string {
  if (syncing) return '동기화 중…';
  if (error) return error;
  if (!lastSynced) return '아직 동기화하지 않았어요.';
  return `마지막 동기화 ${lastSynced.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function Account() {
  const { enabled, user, syncing, syncError, lastSynced, syncNow, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그아웃하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <h1>계정</h1>
      </header>

      {!enabled && (
        <section className="card card--lg stack-sm">
          <h2 className="card-title">이 기기에 저장 중</h2>
          <p className="muted small">로그인 기능이 아직 설정되지 않았어요. 학습 기록은 이 브라우저에만 저장돼요.</p>
        </section>
      )}

      {enabled && user && (
        <section className="card card--lg stack-sm">
          <div className="account-row">
            <span className="device-avatar" aria-hidden="true">
              {displayName(user)[0].toUpperCase()}
            </span>
            <div className="account-text">
              <div className="device-title">{displayName(user)}</div>
              <div className={syncError ? 'error-text small' : 'muted small'} aria-live="polite">
                {syncLabel(syncing, syncError, lastSynced)}
              </div>
            </div>
          </div>
          <p className="muted small">학습 기록은 이 계정에 저장되고, 같은 계정으로 로그인한 기기끼리 자동으로 맞춰져요.</p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button type="button" className="btn btn--ghost" onClick={() => void syncNow()} disabled={syncing}>
              지금 동기화
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void handleSignOut()} disabled={busy}>
              {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
          <p className="muted xsmall">로그아웃하면 이 기기의 기록은 지워지고, 다시 로그인하면 계정에서 불러와요.</p>
        </section>
      )}

      <p className="muted xsmall">발음 음성: {VOICE_CREDIT}</p>
    </div>
  );
}
