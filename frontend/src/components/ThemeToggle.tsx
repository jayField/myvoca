import { useState } from 'react';
import { MoonIcon, SunIcon } from './Icons';

type Theme = 'dark' | 'light';
const THEME_KEY = 'tango-note.theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn icon-btn--framed theme-toggle"
      aria-label={next === 'light' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // Theme still applies for this visit.
        }
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
