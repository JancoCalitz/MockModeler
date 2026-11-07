import type { Domain, Question, Track } from './schema.ts';

// Timed mocks follow the real exam's format. Other question types are for practice only, until the
// track's file says the real exam has them.
export function allowedInMock(question: Question, track: Track): boolean {
  if (question.track !== track.id) return false;
  if (question.multiSelect && !track.mock.allowMultiSelect) return false;
  if (question.scenario && !track.mock.allowScenario) return false;
  return true;
}

// A mock shorter than the real exam keeps the real exam's time per question.
export function mockMinutes(track: Track, questionCount: number): number {
  return Math.ceil((track.durationMinutes * questionCount) / track.questionCount);
}

// How far a domain's number of questions may stray from its weighting. A small domain would
// otherwise fail over a rounding error.
export function balanceTolerance(expected: number): number {
  return Math.max(2, Math.ceil(expected * 0.25));
}

// The domains whose share of these questions is too far from the blueprint.
export function unbalancedDomains(
  domains: readonly Domain[],
  questions: readonly Pick<Question, 'domain'>[],
): { domain: string; count: number; expected: number }[] {
  return domains.flatMap((domain) => {
    const count = questions.filter((question) => question.domain === domain.id).length;
    const expected = (domain.weight / 100) * questions.length;
    return Math.abs(count - expected) > balanceTolerance(expected)
      ? [{ domain: domain.id, count, expected }]
      : [];
  });
}
