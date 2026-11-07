import { examQuestions, trackById } from '../content/bank.ts';
import type { Exam, Question } from '../content/schema.ts';
import type { Attempt } from './attempt.ts';

export type MultiSelectRule = 'all-or-nothing' | 'partial';

export interface DomainScore {
  domain: string;
  percent: number;
  questions: number;
}

export interface QuestionScore {
  question: Question;
  // From 0 to 1.
  earned: number;
  timeMs: number;
}

export interface AttemptScore {
  percent: number;
  passed: boolean;
  domains: DomainScore[];
  questions: QuestionScore[];
}

// Mocks use all-or-nothing, as the real exam's questions are right or wrong. With partial, each
// correct choice earns a share, and each wrong choice takes one away.
export function scoreQuestion(
  question: Pick<Question, 'correctIndexes' | 'multiSelect'>,
  selected: readonly number[],
  rule: MultiSelectRule = 'all-or-nothing',
): number {
  if (selected.length === 0) return 0;
  const correct = new Set(question.correctIndexes);
  const hits = selected.filter((option) => correct.has(option)).length;
  const wrong = selected.length - hits;
  if (question.multiSelect && rule === 'partial') {
    return Math.max(0, (hits - wrong) / correct.size);
  }
  return wrong === 0 && hits === correct.size ? 1 : 0;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreAttempt(attempt: Attempt, exam: Exam): AttemptScore {
  const questions: QuestionScore[] = examQuestions(exam).map((question) => ({
    question,
    timeMs: attempt.timeSpentMs[question.id] ?? 0,
    earned: scoreQuestion(question, attempt.answers[question.id]?.selected ?? []),
  }));
  const percent = average(questions.map(({ earned }) => earned)) * 100;

  const byDomain = new Map<string, number[]>();
  for (const { question, earned } of questions) {
    byDomain.set(question.domain, [...(byDomain.get(question.domain) ?? []), earned]);
  }
  const domains = [...byDomain].map(([domain, earned]): DomainScore => ({
    domain,
    percent: average(earned) * 100,
    questions: earned.length,
  }));

  return {
    percent,
    passed: percent >= trackById(exam.track).passMark,
    domains: domains.sort((a, b) => a.percent - b.percent),
    questions,
  };
}

// Rounds down, so a score just under the pass mark can never read as if it reached it.
export function displayPercent(percent: number): number {
  return Math.floor(percent);
}

// Combines domain results across attempts, weighting each by its number of questions.
export function combineDomains(lists: readonly DomainScore[][]): DomainScore[] {
  const totals = new Map<string, { earned: number; questions: number }>();
  for (const { domain, percent, questions } of lists.flat()) {
    const total = totals.get(domain) ?? { earned: 0, questions: 0 };
    totals.set(domain, {
      earned: total.earned + (percent / 100) * questions,
      questions: total.questions + questions,
    });
  }
  return [...totals]
    .map(([domain, { earned, questions }]) => ({
      domain,
      questions,
      percent: (earned / questions) * 100,
    }))
    .sort((a, b) => a.percent - b.percent);
}
