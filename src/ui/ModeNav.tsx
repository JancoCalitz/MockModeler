import { useEffect, useState } from 'react';
import { TRACKS } from '../content/bank.ts';
import type { TrackId } from '../content/schema.ts';
import { useTheme } from '../themes/store.ts';
import { ThemeMenu } from '../themes/ThemeMenu.tsx';

export type Mode = 'exam' | 'study' | 'drill' | 'progress' | 'data';

const MODES: [Mode, string][] = [
  ['exam', 'Mock exam'],
  ['study', 'Study notes'],
  ['drill', 'Practice drill'],
  ['progress', 'Progress'],
  ['data', 'Backups'],
];

const TRACK_LABELS: Record<TrackId, string> = { associate: 'Associate', developer: 'Developer' };

// The 1990s theme turns the top bar into a taskbar, which has a clock at its end.
function TaskbarClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="ui-clock" dateTime={now.toISOString()}>
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </time>
  );
}

interface ModeNavProps {
  current: Mode;
  onChange: (mode: Mode) => void;
  track: TrackId;
  onTrackChange: (track: TrackId) => void;
}

// The bar at the top of every practice screen: the logo leads home, then the certification being
// practised, the practice modes, and the theme picker. On phones and tablets the modes fold into a
// menu.
export function ModeNav({ current, onChange, track, onTrackChange }: ModeNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useTheme();
  const choose = (mode: Mode) => {
    setMenuOpen(false);
    onChange(mode);
  };
  const link = (mode: Mode, label: string, extra = '') => (
    <button
      key={mode}
      type="button"
      aria-current={mode === current ? 'page' : undefined}
      className={`rounded px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap ${extra} ${
        mode === current ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
      onClick={() => choose(mode)}
    >
      {label}
    </button>
  );

  const trackSwitch = (
    <div
      role="group"
      aria-label="Certification"
      className="flex shrink-0 overflow-hidden rounded border border-slate-300"
    >
      {TRACKS.map(({ id }) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === track}
          className={`px-3 py-1.5 text-sm font-medium ${
            id === track ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
          onClick={() => onTrackChange(id)}
        >
          {TRACK_LABELS[id]}
        </button>
      ))}
    </div>
  );

  return (
    <header className="ui-topbar border-b border-slate-200 font-sans">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <button
          type="button"
          className="app-logo shrink-0 text-lg font-semibold sm:mr-2"
          onClick={() => choose('exam')}
        >
          MockModeler
        </button>
        <div className="hidden sm:block">{trackSwitch}</div>
        <nav aria-label="Practice modes" className="ui-nav hidden flex-1 gap-1 lg:flex">
          {MODES.map(([mode, label]) => link(mode, label))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu />
          {theme.id === 'desktop90s' && <TaskbarClock />}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mode-menu"
            className="ui-btn rounded border border-slate-300 px-2.5 py-1 text-sm font-medium lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>
        </div>
      </div>
      {/* No room beside the logo on a phone, so it takes a row of its own. */}
      <div className="flex justify-center px-4 pb-2 sm:hidden">{trackSwitch}</div>
      {menuOpen && (
        <nav
          id="mode-menu"
          aria-label="Practice modes"
          className="ui-nav flex flex-col gap-1 border-t border-slate-200 px-4 py-2 lg:hidden"
        >
          {MODES.map(([mode, label]) => link(mode, label, 'w-full'))}
        </nav>
      )}
    </header>
  );
}
