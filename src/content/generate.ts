import { allowedInMock, mockMinutes } from './mock-rules.ts';
import type { Exam, Question, Track } from './schema.ts';

type Random = () => number;

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// Shares `total` questions out by weight, using the largest remainder method, without giving a
// domain more than it has available. What a full domain cannot use goes to the others.
export function apportion(
  domains: readonly { id: string; weight: number; available: number }[],
  total: number,
): Map<string, number> {
  const counts = new Map(domains.map((domain) => [domain.id, 0]));
  let left = Math.min(
    total,
    domains.reduce((sum, domain) => sum + domain.available, 0),
  );
  while (left > 0) {
    const open = domains.filter((domain) => counts.get(domain.id)! < domain.available);
    const totalWeight = open.reduce((sum, domain) => sum + domain.weight, 0);
    const shares = open.map((domain) => {
      const share = (domain.weight / totalWeight) * left;
      const room = domain.available - counts.get(domain.id)!;
      return { id: domain.id, whole: Math.min(room, Math.floor(share)), part: share % 1 };
    });
    let given = 0;
    for (const { id, whole } of shares) {
      counts.set(id, counts.get(id)! + whole);
      given += whole;
    }
    // Too few questions left for any domain to earn a whole one, so the largest share gets one.
    if (given === 0) {
      const next = shares.reduce((best, share) => (share.part > best.part ? share : best));
      counts.set(next.id, counts.get(next.id)! + 1);
      given = 1;
    }
    left -= given;
  }
  return counts;
}

// Weights that favour weak domains, for a mock aimed at them. A domain never tried counts as average.
export function weakAreaWeights(
  track: Track,
  scores: ReadonlyMap<string, number>,
): Map<string, number> {
  return new Map(
    track.domains.map((domain) => {
      const score = scores.get(domain.id) ?? 50;
      return [domain.id, domain.weight * (1 + 3 * (1 - score / 100))];
    }),
  );
}

interface GenerateOptions {
  track: Track;
  bank: readonly Question[];
  seen: ReadonlySet<string>;
  now: number;
  random?: Random;
  // Replaces the blueprint's weights.
  weights?: ReadonlyMap<string, number>;
  name?: string;
}

// A random mock, weighted by domain. It avoids questions already seen for as long as there are
// others, and is as long as the real exam once the bank is big enough.
export function generateExam({
  track,
  bank,
  seen,
  now,
  random = Math.random,
  weights,
  name = 'Random mock',
}: GenerateOptions): Exam {
  const pool = bank.filter((question) => allowedInMock(question, track));
  const byDomain = new Map(
    track.domains.map((domain) => [
      domain.id,
      shuffled(
        pool.filter((question) => question.domain === domain.id),
        random,
      ).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id))),
    ]),
  );
  const counts = apportion(
    track.domains.map((domain) => ({
      id: domain.id,
      weight: weights?.get(domain.id) ?? domain.weight,
      available: byDomain.get(domain.id)!.length,
    })),
    track.questionCount,
  );
  const questions = shuffled(
    track.domains.flatMap((domain) => byDomain.get(domain.id)!.slice(0, counts.get(domain.id)!)),
    random,
  ).map((question) => question.id);

  return {
    id: `random-${track.id}-${now}`,
    track: track.id,
    name,
    questions,
    durationMinutes: mockMinutes(track, questions.length),
    proctoring: { requireFullscreen: false, warnAfterViolations: 2 },
  };
}
