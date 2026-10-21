import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import { BookIcon, ChartIcon, DeviceIcon, HomeIcon, QuizIcon } from './components/Icons';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: '홈', icon: <HomeIcon />, end: true },
  { to: '/decks', label: '단어장', icon: <BookIcon /> },
  { to: '/quiz', label: '퀴즈', icon: <QuizIcon /> },
  { to: '/stats', label: '기록', icon: <ChartIcon /> },
];

function AccountBox() {
  const { enabled, user, syncError } = useAuth();
  let title = '이 기기에 저장 중';
  let sub = enabled ? '로그인하면 기기 간 동기화' : '로그인 없이 사용';
  if (user) {
    title = user.email ?? '내 계정';
    sub = syncError ? '동기화 오류' : '기기 간 동기화 켜짐';
  }
  return (
    <Link to="/account" className="device-box" aria-label={`계정: ${title}, ${sub}`}>
      <span className="device-avatar" aria-hidden="true">
        {user ? (user.email?.[0]?.toUpperCase() ?? '나') : <DeviceIcon />}
      </span>
      <div className="device-text">
        <div className="device-title">{title}</div>
        <div className={syncError && user ? 'device-sub danger-text' : 'device-sub'}>{sub}</div>
      </div>
    </Link>
  );
}

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" lang="ja">
          <span className="brand-full">単語ノート</span>
          <span className="brand-short" aria-hidden="true">
            単
          </span>
        </div>
        <nav aria-label="주요 메뉴" className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link" title={n.label}>
              {n.icon}
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <AccountBox />
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav aria-label="주요 메뉴" className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab-link">
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
