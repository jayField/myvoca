import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import { displayName } from './lib/username';
import { BookIcon, CalendarIcon, ChartIcon, DeviceIcon, FeedbackIcon, HomeIcon, KanaIcon, MusicIcon, PatternIcon, NumberIcon, QuizIcon, TableIcon, TalkIcon } from './components/Icons';

// `short` is the bottom tab bar's label on phones, where twelve tabs leave little room.
const NAV: { to: string; label: string; short?: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: '홈', icon: <HomeIcon />, end: true },
  { to: '/decks', label: '단어장', icon: <BookIcon /> },
  { to: '/daily', label: '하루 단어', short: '하루', icon: <CalendarIcon /> },
  { to: '/talk', label: '회화 노트', short: '회화', icon: <TalkIcon /> },
  { to: '/kana', label: '가나표', icon: <KanaIcon /> },
  { to: '/numbers', label: '숫자', icon: <NumberIcon /> },
  { to: '/patterns', label: '표현', icon: <PatternIcon /> },
  { to: '/songs', label: '노래', icon: <MusicIcon /> },
  { to: '/quiz', label: '퀴즈', icon: <QuizIcon /> },
  { to: '/log', label: '복습표', icon: <TableIcon /> },
  { to: '/stats', label: '기록', icon: <ChartIcon /> },
  { to: '/feedback', label: '피드백', icon: <FeedbackIcon /> },
];

function AccountBox() {
  const { enabled, user, syncError } = useAuth();
  let title = '이 기기에 저장 중';
  let sub = enabled ? '로그인하면 기기 간 동기화' : '로그인 없이 사용';
  if (user) {
    title = displayName(user);
    sub = syncError ? '동기화 오류' : '기기 간 동기화 켜짐';
  }
  return (
    <Link to="/account" className="device-box" aria-label={`계정: ${title}, ${sub}`}>
      <span className="device-avatar" aria-hidden="true">
        {user ? displayName(user)[0].toUpperCase() : <DeviceIcon />}
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
          <span className="brand-full">
            単語ノート <span className="brand-emoji" aria-hidden="true">🌙</span>
          </span>
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
            <span>{n.short ?? n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
