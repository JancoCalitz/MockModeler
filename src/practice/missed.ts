// Remembers what someone got wrong, across exams and drills, until they get it right. This outlives
// exam history, whose detail can be dropped when the browser's storage fills up.
const MISSED_KEY = 'mockmodeler.missed';
const REMEMBERED_ATTEMPTS = 100;

export interface MissedStore {
  // When each was last got wrong, by id.
  questions: Record<string, number>;
  // Attempts already counted, as a finished attempt can be shown again after a refresh.
  attempts: string[];
}

function empty(): MissedStore {
  return { questions: {}, attempts: [] };
}

export function loadMissed(): MissedStore {
  try {
    const saved = JSON.parse(localStorage.getItem(MISSED_KEY) ?? 'null') as MissedStore | null;
    return saved?.questions && saved.attempts ? saved : empty();
  } catch {
    return empty();
  }
}

function save(store: MissedStore): void {
  try {
    localStorage.setItem(MISSED_KEY, JSON.stringify(store));
  } catch {
    // This only guides practice, so carrying on without it is fine.
  }
}

function withResult(
  items: Record<string, number>,
  id: string,
  correct: boolean,
  now: number,
): Record<string, number> {
  if (!correct) return { ...items, [id]: now };
  const remaining = { ...items };
  delete remaining[id];
  return remaining;
}

export function recordQuestionResult(id: string, correct: boolean, now: number): void {
  const store = loadMissed();
  save({ ...store, questions: withResult(store.questions, id, correct, now) });
}

export interface AttemptResult {
  id: string;
  correct: boolean;
}

export function recordAttempt(attemptId: string, results: AttemptResult[], now: number): void {
  const store = loadMissed();
  if (store.attempts.includes(attemptId)) return;
  let { questions } = store;
  for (const { id, correct } of results) questions = withResult(questions, id, correct, now);
  save({
    questions,
    attempts: [...store.attempts, attemptId].slice(-REMEMBERED_ATTEMPTS),
  });
}

// Most recently missed first. A question may have left the bank since it was missed.
export function missedIds(items: Record<string, number>, known: ReadonlySet<string>): string[] {
  return Object.entries(items)
    .filter(([id]) => known.has(id))
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
}

// For a restored backup. The later date wins, and a question missed on either side stays missed.
export function mergeMissed(incoming: MissedStore): void {
  const store = loadMissed();
  const questions = { ...store.questions };
  for (const [id, time] of Object.entries(incoming.questions)) {
    questions[id] = Math.max(questions[id] ?? 0, time);
  }
  save({
    questions,
    attempts: [...new Set([...store.attempts, ...incoming.attempts])].slice(-REMEMBERED_ATTEMPTS),
  });
}
