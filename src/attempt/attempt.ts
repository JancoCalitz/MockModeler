import { examDuration } from '../content/bank.ts';
import type { Exam, Question, TrackId } from '../content/schema.ts';
import type { Integrity } from './integrity.ts';

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';

export interface Answer {
  selected: number[];
  flagged: boolean;
}

export interface Attempt {
  version: 1;
  id: string;
  examId: string;
  track: TrackId;
  status: AttemptStatus;
  startedAt: number;
  deadline: number;
  finishedAt?: number;
  currentIndex: number;
  answers: Record<string, Answer>;
  timeSpentMs: Record<string, number>;
  requireFullscreen?: boolean;
  integrity?: Integrity;
  // Only for a randomly generated exam, which is not in the bank.
  generatedExam?: Exam;
}

export type QuestionStatus = 'answered' | 'unanswered';

export function startAttempt(
  exam: Exam,
  now: number,
  {
    requireFullscreen = false,
    generated = false,
  }: { requireFullscreen?: boolean; generated?: boolean } = {},
): Attempt {
  return {
    requireFullscreen,
    ...(generated ? { generatedExam: exam } : {}),
    version: 1,
    id: `${exam.id}-${now}`,
    examId: exam.id,
    track: exam.track,
    status: 'in_progress',
    startedAt: now,
    deadline: now + examDuration(exam) * 60_000,
    currentIndex: 0,
    answers: {},
    timeSpentMs: {},
  };
}

// The attempt is finished once, and answers cannot change afterwards.
function whileInProgress(attempt: Attempt, change: (attempt: Attempt) => Attempt): Attempt {
  return attempt.status === 'in_progress' ? change(attempt) : attempt;
}

export function finishAttempt(
  attempt: Attempt,
  status: 'submitted' | 'expired',
  now: number,
): Attempt {
  return whileInProgress(attempt, (current) => ({ ...current, status, finishedAt: now }));
}

// Called on load and on every timer tick, so closing the tab cannot extend the time.
export function applyDeadline(attempt: Attempt, now: number): Attempt {
  return now >= attempt.deadline ? finishAttempt(attempt, 'expired', attempt.deadline) : attempt;
}

export function remainingMs(attempt: Attempt, now: number): number {
  return Math.max(0, attempt.deadline - now);
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
}

export function goToQuestion(attempt: Attempt, index: number): Attempt {
  return { ...attempt, currentIndex: index };
}

export function addTimeSpent(attempt: Attempt, questionId: string, ms: number): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    timeSpentMs: {
      ...current.timeSpentMs,
      [questionId]: (current.timeSpentMs[questionId] ?? 0) + ms,
    },
  }));
}

function answerFor(attempt: Attempt, id: string): Answer {
  return attempt.answers[id] ?? { selected: [], flagged: false };
}

export function selectOption(
  attempt: Attempt,
  id: string,
  option: number,
  multiSelect: boolean,
): Attempt {
  return whileInProgress(attempt, (current) => {
    const answer = answerFor(current, id);
    const selected = !multiSelect
      ? [option]
      : answer.selected.includes(option)
        ? answer.selected.filter((value) => value !== option)
        : [...answer.selected, option].sort((a, b) => a - b);
    return { ...current, answers: { ...current.answers, [id]: { ...answer, selected } } };
  });
}

export function clearSelection(attempt: Attempt, id: string): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    answers: { ...current.answers, [id]: { ...answerFor(current, id), selected: [] } },
  }));
}

export function toggleFlag(attempt: Attempt, id: string): Attempt {
  return whileInProgress(attempt, (current) => {
    const answer = answerFor(current, id);
    return {
      ...current,
      answers: { ...current.answers, [id]: { ...answer, flagged: !answer.flagged } },
    };
  });
}

export function isFlagged(attempt: Attempt, id: string): boolean {
  return answerFor(attempt, id).flagged;
}

export function questionStatus(attempt: Attempt, id: string): QuestionStatus {
  return answerFor(attempt, id).selected.length > 0 ? 'answered' : 'unanswered';
}

export function examSummary(attempt: Attempt, questions: readonly Question[]) {
  const unanswered = questions.filter(
    (question) => questionStatus(attempt, question.id) === 'unanswered',
  ).length;
  const flagged = questions.filter((question) => isFlagged(attempt, question.id)).length;
  return { total: questions.length, answered: questions.length - unanswered, unanswered, flagged };
}
