import type { HistoryEntry } from '../attempt/history.ts';
import { combineDomains, scoreQuestion } from '../attempt/score.ts';
import { findQuestion, questionsFor } from '../content/bank.ts';
import type { Question, TrackId } from '../content/schema.ts';

export interface DrillAnswer {
  selected: number[];
  checked: boolean;
}

export interface Drill {
  track: TrackId;
  questionIds: string[];
  index: number;
  answers: Record<string, DrillAnswer>;
  finished: boolean;
  // Keeps each question's answers in one order for this drill, with a new order in the next.
  seed: string;
}

// Recent attempts show current ability better than an all-time average would.
const RECENT_ATTEMPTS = 5;

const drillKey = (track: TrackId) => `mockmodeler.drill.${track}`;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function drillFromIds(track: TrackId, ids: string[], random: () => number): Drill {
  return {
    track,
    questionIds: ids,
    index: 0,
    answers: {},
    finished: false,
    seed: String(random()),
  };
}

export function startDrill(
  track: TrackId,
  domains: readonly string[],
  count: number,
  random: () => number = Math.random,
): Drill {
  const pool = questionsFor(track).filter((question) => domains.includes(question.domain));
  return drillFromIds(
    track,
    shuffled(pool, random)
      .slice(0, count)
      .map((question) => question.id),
    random,
  );
}

export function retryQuestions(
  track: TrackId,
  ids: string[],
  random: () => number = Math.random,
): Drill {
  return drillFromIds(track, shuffled(ids, random), random);
}

// A case study's questions stay in the order they were written, as they build on each other.
export function scenarioDrill(
  track: TrackId,
  scenario: string,
  random: () => number = Math.random,
): Drill {
  const ids = questionsFor(track)
    .filter((question) => question.scenario === scenario)
    .map((question) => question.id);
  return drillFromIds(track, ids, random);
}

export function weakestDomains(entries: readonly HistoryEntry[], count: number): string[] {
  return combineDomains(entries.slice(-RECENT_ATTEMPTS).map((entry) => entry.domains))
    .filter((domain) => domain.percent < 100)
    .slice(0, count)
    .map((domain) => domain.domain);
}

export function chooseOption(drill: Drill, question: Question, option: number): Drill {
  const answer = drill.answers[question.id] ?? { selected: [], checked: false };
  if (answer.checked) return drill;
  const selected = !question.multiSelect
    ? [option]
    : answer.selected.includes(option)
      ? answer.selected.filter((value) => value !== option)
      : [...answer.selected, option].sort((a, b) => a - b);
  return { ...drill, answers: { ...drill.answers, [question.id]: { ...answer, selected } } };
}

export function checkAnswer(drill: Drill, id: string): Drill {
  const answer = drill.answers[id];
  if (!answer || answer.selected.length === 0) return drill;
  return { ...drill, answers: { ...drill.answers, [id]: { ...answer, checked: true } } };
}

export function nextQuestion(drill: Drill): Drill {
  const last = drill.index >= drill.questionIds.length - 1;
  return last ? { ...drill, finished: true } : { ...drill, index: drill.index + 1 };
}

export function isCorrect(drill: Drill, question: Question): boolean {
  return scoreQuestion(question, drill.answers[question.id]?.selected ?? []) === 1;
}

export function drillSummary(drill: Drill) {
  const questions = drill.questionIds.flatMap((id) => {
    const question = findQuestion(id);
    return question ? [question] : [];
  });
  const missed = questions.filter((question) => !isCorrect(drill, question));
  return {
    total: questions.length,
    correct: questions.length - missed.length,
    missedIds: missed.map((question) => question.id),
  };
}

export function loadDrill(track: TrackId): Drill | null {
  try {
    const saved = JSON.parse(localStorage.getItem(drillKey(track)) ?? 'null') as Drill | null;
    // A question may have left the bank since this was saved.
    return saved && saved.questionIds.every((id) => findQuestion(id)) ? saved : null;
  } catch {
    return null;
  }
}

export function saveDrill(track: TrackId, drill: Drill | null): void {
  try {
    if (drill) localStorage.setItem(drillKey(track), JSON.stringify(drill));
    else localStorage.removeItem(drillKey(track));
  } catch {
    // A drill is only practice, so carrying on without saving it is fine.
  }
}
