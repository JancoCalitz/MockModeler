import { useState } from 'react';
import type { HistoryEntry } from '../attempt/history.ts';
import { combineDomains, displayPercent } from '../attempt/score.ts';
import { domainLabel, questionsFor, trackById } from '../content/bank.ts';
import type { TrackId } from '../content/schema.ts';
import { retryQuestions, startDrill, weakestDomains, type Drill } from '../practice/drill.ts';
import { loadMissed, missedIds } from '../practice/missed.ts';
import { useTheme } from '../themes/store.ts';
import { PercentBars, ScoreTrend, TargetMeter } from './charts.tsx';

// Recent attempts show current ability better than an all-time average would.
const RECENT_ATTEMPTS = 3;
const DOMAIN_ATTEMPTS = 5;
const WEAKEST_DOMAINS = 5;
const PRACTICE_QUESTIONS = 10;
const PRACTICE_DOMAINS = 3;

function formatDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface ReadinessProps {
  track: TrackId;
  // This track's attempts, oldest first.
  entries: HistoryEntry[];
  onOpen: (id: string) => void;
  onBack: () => void;
  onClear: () => void;
  onDrill: (drill: Drill) => void;
  onWeakMock: () => void;
}

function PracticeNext({
  track,
  entries,
  onDrill,
  onWeakMock,
}: Pick<ReadinessProps, 'track' | 'entries' | 'onDrill' | 'onWeakMock'>) {
  const known = new Set(questionsFor(track).map((question) => question.id));
  const missed = missedIds(loadMissed().questions, known);
  const weak = weakestDomains(entries, PRACTICE_DOMAINS);
  if (missed.length === 0 && weak.length === 0) return null;
  const buttonClass = 'ui-btn rounded border border-slate-300 px-3 py-2 text-sm font-medium';
  return (
    <section className="ui-card mt-6 rounded-lg border border-slate-200 p-5">
      <h2 className="text-lg font-semibold">What to practise next</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {missed.length > 0 && (
          <button
            type="button"
            className="ui-btn ui-btn-primary rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => onDrill(retryQuestions(track, missed.slice(0, PRACTICE_QUESTIONS)))}
          >
            Retry {Math.min(PRACTICE_QUESTIONS, missed.length)} of the {missed.length}{' '}
            {missed.length === 1 ? 'question' : 'questions'} you got wrong
          </button>
        )}
        {weak.length > 0 && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => onDrill(startDrill(track, weak, PRACTICE_QUESTIONS))}
          >
            Drill your weakest domains
          </button>
        )}
        <button type="button" className={buttonClass} onClick={onWeakMock}>
          Take a weak areas mock
        </button>
      </div>
    </section>
  );
}

export function Readiness({
  track: trackId,
  entries,
  onOpen,
  onBack,
  onClear,
  onDrill,
  onWeakMock,
}: ReadinessProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const track = trackById(trackId);
  const target = track.readinessTarget;
  const recent = entries.slice(-RECENT_ATTEMPTS);
  const average =
    recent.length > 0
      ? recent.reduce((sum, entry) => sum + entry.percent, 0) / recent.length
      : null;
  const weakest = combineDomains(
    entries.slice(-DOMAIN_ATTEMPTS).map((entry) => entry.domains),
  ).slice(0, WEAKEST_DOMAINS);
  const gap = average === null ? 0 : target - displayPercent(average);
  const theme = useTheme();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-sans text-slate-900 sm:px-8">
      <button type="button" className="text-sm text-slate-600 underline" onClick={onBack}>
        Back
      </button>
      <h1 className="mt-2 text-3xl font-bold">Your progress</h1>
      <p className="mt-1 text-sm text-slate-600">{track.name}</p>
      {theme.id === 'desktop90s' && (
        <p className="ui-counter">
          Tests taken:
          <span className="ui-counter-digits">{String(entries.length).padStart(6, '0')}</span>
        </p>
      )}

      {entries.length === 0 || average === null ? (
        <p className="mt-4 text-slate-700">Finish a test to see your progress here.</p>
      ) : (
        <>
          <section className="ui-card mt-6 rounded-lg border border-slate-200 p-5">
            <h2 className="text-sm font-medium text-slate-600">
              Average of your last {recent.length === 1 ? 'attempt' : `${recent.length} attempts`}
            </h2>
            <p className="text-5xl font-bold tabular-nums">{displayPercent(average)}%</p>
            <p className="mt-1 text-sm text-slate-700">
              {gap <= 0
                ? `✓ At or above the ${target}% target. The real exam's pass mark is ${track.passMark}%.`
                : `${gap} ${gap === 1 ? 'point' : 'points'} to go to reach the ${target}% target. The real exam's pass mark is ${track.passMark}%.`}
            </p>
            <div className="mt-6">
              <TargetMeter percent={average} target={target} />
            </div>
          </section>

          <PracticeNext
            track={trackId}
            entries={entries}
            onDrill={onDrill}
            onWeakMock={onWeakMock}
          />

          <section className="mt-6">
            <h2 className="text-lg font-semibold">Score by attempt</h2>
            <div className="mt-2">
              <ScoreTrend
                target={target}
                points={entries.map((entry, index) => ({
                  label: `Attempt ${index + 1}`,
                  percent: entry.percent,
                }))}
              />
            </div>
          </section>

          {weakest.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">Weakest domains</h2>
              <p className="text-sm text-slate-600">
                From your last {Math.min(entries.length, DOMAIN_ATTEMPTS)}{' '}
                {entries.length === 1 ? 'attempt' : 'attempts'}.
              </p>
              <div className="mt-2">
                <PercentBars
                  label="Weakest domains"
                  rows={weakest.map((domain) => ({
                    label: domainLabel(track, domain.domain),
                    percent: domain.percent,
                    detail: `${domain.questions} ${domain.questions === 1 ? 'question' : 'questions'}`,
                  }))}
                />
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-semibold">Attempts</h2>
            {/* On a narrow screen the table scrolls sideways within its own box. */}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-slate-300 text-xs text-slate-600">
                  <tr>
                    <th className="py-1 font-medium">Attempt</th>
                    <th className="py-1 font-medium">Exam</th>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 text-right font-medium">Score</th>
                    <th className="py-1 pl-3 font-medium">Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...entries]
                    .map((entry, index) => ({ entry, number: index + 1 }))
                    .reverse()
                    .map(({ entry, number }) => (
                      <tr key={entry.id} className="border-b border-slate-100">
                        <td className="py-1.5">{number}</td>
                        <td className="py-1.5">{entry.examName}</td>
                        <td className="py-1.5">{formatDate(entry.finishedAt)}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">
                          {displayPercent(entry.percent)}%
                        </td>
                        <td className="py-1.5 pl-3 text-xs text-slate-600">
                          {[
                            entry.passed ? 'Passed' : 'Below pass mark',
                            entry.status === 'expired' && 'Ran out of time',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </td>
                        <td className="py-1.5 text-right">
                          {entry.attempt && (
                            <button
                              type="button"
                              className="text-xs underline"
                              aria-label={`Review attempt ${number}`}
                              onClick={() => onOpen(entry.id)}
                            >
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-8 text-sm">
            {confirmingClear ? (
              <p className="flex flex-wrap items-center gap-2">
                Delete all {track.name} progress in this browser? This cannot be undone.
                <button
                  type="button"
                  className="ui-btn ui-btn-danger rounded bg-red-700 px-2 py-1 text-white"
                  onClick={onClear}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="ui-btn rounded border border-slate-300 px-2 py-1"
                  onClick={() => setConfirmingClear(false)}
                >
                  Keep it
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="text-slate-600 underline"
                onClick={() => setConfirmingClear(true)}
              >
                Delete this track's progress
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
