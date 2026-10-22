import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { VOICE_CREDIT } from '../speech';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { enabled } = useAuth();
  return (
    <div className="auth-page">
      <div className="auth-top">
        <span className="brand-link" lang="ja">
          単語ノート <span className="brand-emoji" aria-hidden="true">🌙</span>
        </span>
        <ThemeToggle />
      </div>
      <main className="auth-card">
        <div className="auth-heading">
          <h1>{title}</h1>
          <p className="muted small">{subtitle}</p>
        </div>
        {enabled ? (
          children
        ) : (
          <p className="banner-error">로그인 기능이 아직 설정되지 않았어요. 지금은 로그인 없이 이 기기에서만 사용할 수 있어요.</p>
        )}
      </main>
      <p className="muted xsmall">발음 음성: {VOICE_CREDIT}</p>
      {!enabled && (
        <Link to="/" className="muted small auth-guest">
          로그인 없이 계속하기
        </Link>
      )}
    </div>
  );
}
