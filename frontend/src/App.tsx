import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BookIcon, ChartIcon, DeviceIcon, HomeIcon, QuizIcon } from './components/Icons';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: '홈', icon: <HomeIcon />, end: true },
  { to: '/decks', label: '단어장', icon: <BookIcon /> },
  { to: '/quiz', label: '퀴즈', icon: <QuizIcon /> },
  { to: '/stats', label: '기록', icon: <ChartIcon /> },
];

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" lang="ja">
          単語ノート
        </div>
        <nav aria-label="주요 메뉴" className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="device-box">
          <span className="device-avatar">
            <DeviceIcon />
          </span>
          <div>
            <div className="device-title">이 기기에 저장 중</div>
            <div className="device-sub">로그인 없이 사용</div>
          </div>
        </div>
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
