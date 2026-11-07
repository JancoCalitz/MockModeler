import { useCallback, useRef, useState } from 'react';
import { startAttempt, type Attempt } from './attempt/attempt.ts';
import { clearHistory, loadHistory } from './attempt/history.ts';
import { loadAttempt, saveAttempt } from './attempt/storage.ts';
import { examFor } from './content/bank.ts';
import type { TrackId } from './content/schema.ts';
import { loadTrack, saveTrack } from './content/track.ts';
import { saveDrill, type Drill } from './practice/drill.ts';
import { DataScreen } from './ui/DataScreen.tsx';
import { DrillScreen } from './ui/DrillScreen.tsx';
import { ExamScreen } from './ui/ExamScreen.tsx';
import { Landing, weakAreasExam } from './ui/Landing.tsx';
import { ModeNav, type Mode } from './ui/ModeNav.tsx';
import { Readiness } from './ui/Readiness.tsx';
import { Results } from './ui/Results.tsx';
import { StudyScreen } from './ui/StudyScreen.tsx';

export type UpdateAttempt = (change: (attempt: Attempt) => Attempt) => void;

type Screen = { name: 'home' } | { name: 'review'; id: string } | { name: Exclude<Mode, 'exam'> };

export function App() {
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(Date.now()));
  const [saveFailed, setSaveFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [track, setTrack] = useState<TrackId>(loadTrack);
  const latest = useRef(attempt);

  const replace = useCallback((next: Attempt | null) => {
    latest.current = next;
    setAttempt(next);
    setSaveFailed(!saveAttempt(next));
  }, []);

  // Every change is saved immediately, so nothing is lost if the tab closes.
  const update: UpdateAttempt = useCallback(
    (change) => {
      if (latest.current) replace(change(latest.current));
    },
    [replace],
  );

  const home = () => setScreen({ name: 'home' });

  if (attempt) {
    const exam = examFor(attempt)!;
    return (
      <>
        {saveFailed && (
          <p role="alert" className="bg-red-700 px-4 py-2 text-sm text-white">
            Your browser could not save your latest answers, because its storage may be full. Do not
            close this tab.
          </p>
        )}
        {attempt.status === 'in_progress' ? (
          <ExamScreen attempt={attempt} exam={exam} update={update} />
        ) : (
          <Results
            attempt={attempt}
            exam={exam}
            record
            closeLabel="Start a new test"
            onClose={() => {
              setTrack(attempt.track);
              replace(null);
              home();
            }}
            onShowProgress={() => setScreen({ name: 'progress' })}
          />
        )}
      </>
    );
  }

  const history = loadHistory().filter((entry) => entry.track === track);
  const changeMode = (next: Mode) => setScreen(next === 'exam' ? { name: 'home' } : { name: next });
  const changeTrack = (next: TrackId) => {
    saveTrack(next);
    setTrack(next);
    // A past attempt belongs to the other track.
    if (screen.name === 'review') setScreen({ name: 'progress' });
  };
  const navFor = (current: Mode) => (
    <ModeNav current={current} onChange={changeMode} track={track} onTrackChange={changeTrack} />
  );
  const openDrill = (drill: Drill) => {
    saveDrill(drill.track, drill);
    setScreen({ name: 'drill' });
  };

  if (screen.name === 'review') {
    const entry = history.find((candidate) => candidate.id === screen.id);
    const exam = entry?.attempt ? examFor(entry.attempt) : undefined;
    if (entry?.attempt && exam) {
      return (
        <Results
          attempt={entry.attempt}
          exam={exam}
          closeLabel="Back to progress"
          onClose={() => setScreen({ name: 'progress' })}
        />
      );
    }
  }

  if (screen.name === 'progress' || screen.name === 'review') {
    return (
      <>
        {navFor('progress')}
        <Readiness
          key={track}
          track={track}
          entries={history}
          onBack={home}
          onOpen={(id) => setScreen({ name: 'review', id })}
          onDrill={openDrill}
          onWeakMock={() => {
            const exam = weakAreasExam(track, Date.now());
            if (exam) replace(startAttempt(exam, Date.now(), { generated: true }));
          }}
          onClear={() => {
            clearHistory(track);
            home();
          }}
        />
      </>
    );
  }

  const mode: Mode = screen.name === 'home' ? 'exam' : screen.name;

  // Keyed by track, so nothing typed or chosen for one certification carries over to the other.
  return (
    <>
      {navFor(mode)}
      {mode === 'study' && <StudyScreen key={track} track={track} onDrill={openDrill} />}
      {mode === 'drill' && <DrillScreen key={track} track={track} />}
      {mode === 'data' && <DataScreen />}
      {mode === 'exam' && (
        <Landing
          key={track}
          track={track}
          onStart={replace}
          onShowProgress={history.length > 0 ? () => setScreen({ name: 'progress' }) : undefined}
        />
      )}
    </>
  );
}
