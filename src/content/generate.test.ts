import { describe, expect, it } from 'vitest';
import { questionsFor, trackById, TRACKS } from './bank.ts';
import { apportion, generateExam, weakAreaWeights } from './generate.ts';
import { allowedInMock, balanceTolerance, mockMinutes, unbalancedDomains } from './mock-rules.ts';

// A repeatable sequence, so a failure can be reproduced.
function seeded(start = 1) {
  let state = start;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

describe('apportion', () => {
  const domains = [
    { id: 'a', weight: 60, available: 100 },
    { id: 'b', weight: 30, available: 100 },
    { id: 'c', weight: 10, available: 100 },
  ];
  const total = (counts: Map<string, number>) => [...counts.values()].reduce((x, y) => x + y, 0);

  it('shares questions by weight', () => {
    expect(Object.fromEntries(apportion(domains, 10))).toEqual({ a: 6, b: 3, c: 1 });
  });

  it('always gives out the exact total', () => {
    for (const count of [1, 3, 7, 11, 60]) expect(total(apportion(domains, count))).toBe(count);
  });

  it('passes on what a full domain cannot use', () => {
    const limited = [{ ...domains[0]!, available: 2 }, domains[1]!, domains[2]!];
    const counts = apportion(limited, 10);
    expect(counts.get('a')).toBe(2);
    expect(total(counts)).toBe(10);
  });

  it('stops at what is available', () => {
    const small = domains.map((domain) => ({ ...domain, available: 1 }));
    expect(total(apportion(small, 10))).toBe(3);
  });
});

describe.each(TRACKS.map((track) => track.id))('a random %s mock', (trackId) => {
  const track = trackById(trackId);
  const bank = questionsFor(trackId);
  const pool = bank.filter((question) => allowedInMock(question, track));
  const generate = (seen = new Set<string>(), random = seeded()) =>
    generateExam({ track, bank, seen, now: 1, random });

  it('stays in its track, uses only mock questions, and never repeats one', () => {
    const { questions } = generate();
    const allowed = new Set(pool.map((question) => question.id));
    expect(questions.every((id) => allowed.has(id))).toBe(true);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('is as long as the real exam, or uses the whole bank until it is big enough', () => {
    expect(generate().questions).toHaveLength(Math.min(track.questionCount, pool.length));
  });

  it('keeps the real exam time per question', () => {
    const exam = generate();
    expect(exam.durationMinutes).toBe(mockMinutes(track, exam.questions.length));
  });

  it('follows the blueprint weighting', () => {
    const exam = generate();
    const picked = exam.questions.map((id) => pool.find((question) => question.id === id)!);
    expect(unbalancedDomains(track.domains, picked)).toEqual([]);
  });

  it('prefers questions not seen before', () => {
    const half = pool.slice(0, Math.floor(pool.length / 2)).map((question) => question.id);
    const seen = new Set(half);
    const smaller = { ...track, questionCount: Math.floor(pool.length / 4) };
    const exam = generateExam({ track: smaller, bank, seen, now: 1, random: seeded() });
    const domainOf = new Map(pool.map((question) => [question.id, question.domain]));
    const reused = exam.questions.filter((id) => seen.has(id));
    // A question seen before only appears if its domain has run out of unseen ones.
    for (const id of reused) {
      const domain = domainOf.get(id);
      const unseen = pool.filter((q) => q.domain === domain && !seen.has(q.id));
      expect(unseen.every((q) => exam.questions.includes(q.id))).toBe(true);
    }
  });
});

describe('weakAreaWeights', () => {
  const track = trackById('associate');

  it('favours a weak domain over a strong one of the same weight', () => {
    const [first] = track.domains;
    const low = weakAreaWeights(track, new Map([[first!.id, 0]])).get(first!.id)!;
    const high = weakAreaWeights(track, new Map([[first!.id, 100]])).get(first!.id)!;
    expect(low).toBeGreaterThan(high);
    expect(high).toBe(first!.weight);
  });

  it('gives a weak domain more questions in the mock than the blueprint would', () => {
    const domain = track.domains.find((candidate) => candidate.id === 'interpret-dmn')!;
    const scores = new Map(track.domains.map((item) => [item.id, 100]));
    scores.set(domain.id, 0);
    const bank = questionsFor('associate');
    const count = (weights?: Map<string, number>) => {
      const exam = generateExam({
        track: { ...track, questionCount: 20 },
        bank,
        seen: new Set(),
        now: 1,
        random: seeded(),
        weights,
      });
      return exam.questions.filter((id) => id.startsWith('a-dmn-')).length;
    };
    expect(count(weakAreaWeights(track, scores))).toBeGreaterThan(count());
  });
});

describe('unbalancedDomains', () => {
  const domains = [
    { id: 'a', label: 'A', weight: 80 },
    { id: 'b', label: 'B', weight: 20 },
  ];
  const questions = (a: number, b: number) => [
    ...Array.from({ length: a }, () => ({ domain: 'a' })),
    ...Array.from({ length: b }, () => ({ domain: 'b' })),
  ];

  it('accepts a share close to the weighting', () => {
    expect(unbalancedDomains(domains, questions(32, 8))).toEqual([]);
  });

  it('names a domain too far from its weighting', () => {
    const found = unbalancedDomains(domains, questions(10, 30)).map(({ domain }) => domain);
    expect(found).toEqual(['a', 'b']);
  });

  it('allows small domains a little room', () => {
    expect(balanceTolerance(0.4)).toBe(2);
    expect(balanceTolerance(20)).toBe(5);
  });
});
