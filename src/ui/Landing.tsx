import { useState } from 'react';
import { startAttempt, type Attempt } from '../attempt/attempt.ts';
import { loadHistory, seenQuestionIds } from '../attempt/history.ts';
import { combineDomains } from '../attempt/score.ts';
import { examDuration, examsFor, questionsFor, trackById } from '../content/bank.ts';
import { generateExam, weakAreaWeights } from '../content/generate.ts';
import type { Exam, TrackId } from '../content/schema.ts';
import { enterFullscreen } from './useIntegrityTracking.ts';

function storageWorks(): boolean {
  try {
    const key = 'mockmodeler-check';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const RANDOM_EXAM = 'random';
export const WEAK_EXAM = 'weak';

// A mock aimed at the domains this track's recent attempts were weakest in.
export function weakAreasExam(track: TrackId, now: number): Exam | null {
  const entries = loadHistory().filter((entry) => entry.track === track);
  if (entries.length === 0) return null;
  const details = trackById(track);
  const scores = new Map(
    combineDomains(entries.slice(-5).map((entry) => entry.domains)).map((score) => [
      score.domain,
      score.percent,
    ]),
  );
  return generateExam({
    track: details,
    bank: questionsFor(track),
    seen: seenQuestionIds(entries),
    now,
    weights: weakAreaWeights(details, scores),
    name: 'Weak areas mock',
  });
}

interface LandingProps {
  track: TrackId;
  onStart: (attempt: Attempt) => void;
  onShowProgress?: () => void;
}

export function Landing({ track: trackId, onStart, onShowProgress }: LandingProps) {
  const track = trackById(trackId);
  const fixed = examsFor(trackId);
  const [examId, setExamId] = useState(RANDOM_EXAM);
  const [storageOk] = useState(storageWorks);
  const [fullscreenChoice, setFullscreenChoice] = useState<boolean | null>(null);

  // Built once, so what is shown here is exactly what starts. The app gives each track its own
  // Landing, so a change of track builds new ones.
  const [generated] = useState(() => {
    const now = Date.now();
    const history = loadHistory().filter((entry) => entry.track === trackId);
    return {
      random: generateExam({
        track,
        bank: questionsFor(trackId),
        seen: seenQuestionIds(history),
        now,
      }),
      weak: weakAreasExam(trackId, now),
    };
  });

  const exam =
    examId === RANDOM_EXAM
      ? generated.random
      : examId === WEAK_EXAM
        ? (generated.weak ?? generated.random)
        : (fixed.find((candidate) => candidate.id === examId) ?? generated.random);
  const isGenerated = exam === generated.random || exam === generated.weak;
  const requireFullscreen = fullscreenChoice ?? exam.proctoring.requireFullscreen;
  const shortened = exam.questions.length < track.questionCount;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-sans text-slate-900 sm:px-8">
      <p className="font-semibold text-emerald-700">
        {track.code} · Camunda {track.camundaVersion}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{track.name}</h1>
      <p className="mt-2 text-sm text-slate-700">
        An independent practice tool, not affiliated with Camunda. Every question is original, and
        none comes from a real exam.
      </p>

      <section className="ui-card mt-6 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-600">The real exam</h2>
        <dl className="mt-2 grid grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-slate-600">Questions</dt>
            <dd className="font-semibold">{track.questionCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Time</dt>
            <dd className="font-semibold">{track.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">To pass</dt>
            <dd className="font-semibold">{track.passMark}%</dd>
          </div>
        </dl>
        {track.unconfirmed.length > 0 && (
          <details className="mt-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-medium">
              Check these against the official blueprint
            </summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {track.unconfirmed.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <label className="mt-6 block text-sm font-medium">
        Mock exam
        <select
          className="mt-1 block w-full rounded border border-slate-300 p-2"
          value={examId}
          onChange={(event) => setExamId(event.target.value)}
        >
          <option value={RANDOM_EXAM}>Random mock, weighted like the blueprint</option>
          {generated.weak && <option value={WEAK_EXAM}>Weak areas mock, from your results</option>}
          {fixed.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>

      <dl className="ui-card mt-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
        <div>
          <dt className="text-sm text-slate-600">This mock</dt>
          <dd className="font-semibold">{exam.questions.length} questions</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Time allowed</dt>
          <dd className="font-semibold">{examDuration(exam)} minutes</dd>
        </div>
      </dl>
      {shortened && (
        <p className="mt-2 text-sm text-slate-700">
          {isGenerated
            ? `The question bank does not yet have enough for all ${track.questionCount} questions, so this mock is shorter, with the real exam's time per question.`
            : `Shorter than the real exam, with the real exam's time per question.`}
        </p>
      )}

      {/* Folded away, so choosing an exam and starting come first. */}
      <details className="mt-6">
        <summary className="cursor-pointer font-semibold">Before you start: the rules</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>The timer starts when you click Start, and keeps running if you close this tab.</li>
          <li>Your answers save automatically in this browser, and the test submits at time up.</li>
          <li>You can go back to earlier questions, and flag any to return to.</li>
          <li>
            Your report records the time spent on each question, and how often you leave the test,
            right-click, or resize the window. None of this affects your score.
          </li>
        </ul>
      </details>

      {!storageOk && (
        <p role="alert" className="mt-6 rounded bg-red-50 p-3 text-sm text-red-800">
          This browser is not allowing local storage, so your answers cannot be saved. Allow it, or
          use a current version of Chrome or Edge.
        </p>
      )}

      <label className="mt-6 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requireFullscreen}
          onChange={(event) => setFullscreenChoice(event.target.checked)}
        />
        Require full screen
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="ui-btn ui-btn-primary rounded bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
          onClick={() => {
            if (requireFullscreen) enterFullscreen();
            onStart(startAttempt(exam, Date.now(), { requireFullscreen, generated: isGenerated }));
          }}
        >
          Start test
        </button>
        {onShowProgress && (
          <button
            type="button"
            className="ui-btn rounded border border-slate-300 px-5 py-2 font-semibold hover:bg-slate-50"
            onClick={onShowProgress}
          >
            View progress
          </button>
        )}
      </div>
    </main>
  );
}
