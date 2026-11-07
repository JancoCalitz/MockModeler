import type { TrackId } from '../content/schema.ts';
import type { Attempt } from './attempt.ts';
import type { AttemptScore, DomainScore } from './score.ts';

const HISTORY_KEY = 'mockmodeler.history';

export interface HistoryEntry {
  id: string;
  track: TrackId;
  examId: string;
  examName: string;
  status: Attempt['status'];
  finishedAt: number;
  percent: number;
  passed: boolean;
  domains: DomainScore[];
  // Lets a random exam avoid these, even after the detail below is gone.
  questionIds?: string[];
  // Kept for reviewing the attempt later. Dropped from the oldest attempts if storage fills up.
  attempt: Attempt | null;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): boolean {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function historyEntry(
  attempt: Attempt,
  examName: string,
  score: AttemptScore,
): HistoryEntry {
  return {
    id: attempt.id,
    track: attempt.track,
    examId: attempt.examId,
    examName,
    status: attempt.status,
    finishedAt: attempt.finishedAt ?? attempt.deadline,
    percent: score.percent,
    passed: score.passed,
    domains: score.domains,
    questionIds: score.questions.map(({ question }) => question.id),
    attempt,
  };
}

// Adds or replaces an attempt, oldest first. Scores matter more than the detail for review, so
// when storage is full, this gives up the oldest attempts' detail until the entry fits.
export function recordInHistory(entry: HistoryEntry): boolean {
  const entries = [...loadHistory().filter((existing) => existing.id !== entry.id), entry];
  entries.sort((a, b) => a.finishedAt - b.finishedAt);
  if (save(entries)) return true;
  for (const existing of entries) {
    if (existing.attempt && existing.id !== entry.id) {
      existing.attempt = null;
      if (save(entries)) return true;
    }
  }
  entry.attempt = null;
  return save(entries);
}

export function seenQuestionIds(entries: readonly HistoryEntry[]): Set<string> {
  return new Set(entries.flatMap((entry) => entry.questionIds ?? []));
}

// Deletes one track's attempts, leaving the other's.
export function clearHistory(track: TrackId): void {
  save(loadHistory().filter((entry) => entry.track !== track));
}
