import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMS, examDuration, examQuestions, trackById } from '../content/bank.ts';
import { selectOption, startAttempt, formatDuration, type Attempt } from './attempt.ts';
import {
  clearHistory,
  historyEntry,
  loadHistory,
  recordInHistory,
  seenQuestionIds,
} from './history.ts';
import {
  combineDomains,
  displayPercent,
  scoreAttempt,
  scoreQuestion,
  type AttemptScore,
} from './score.ts';

const single = { correctIndexes: [1], multiSelect: false };
const multi = { correctIndexes: [0, 2], multiSelect: true };

describe('scoreQuestion', () => {
  it('gives nothing for no answer', () => {
    expect(scoreQuestion(single, [])).toBe(0);
    expect(scoreQuestion(multi, [], 'partial')).toBe(0);
  });

  it('marks a single answer right or wrong', () => {
    expect(scoreQuestion(single, [1])).toBe(1);
    expect(scoreQuestion(single, [0])).toBe(0);
    expect(scoreQuestion(single, [1], 'partial')).toBe(1);
  });

  it('needs the exact set for all-or-nothing multi-select', () => {
    expect(scoreQuestion(multi, [0, 2])).toBe(1);
    expect(scoreQuestion(multi, [2, 0])).toBe(1);
    expect(scoreQuestion(multi, [0])).toBe(0);
    expect(scoreQuestion(multi, [0, 1, 2])).toBe(0);
  });

  it('gives a share per correct choice for partial multi-select', () => {
    expect(scoreQuestion(multi, [0, 2], 'partial')).toBe(1);
    expect(scoreQuestion(multi, [0], 'partial')).toBe(0.5);
  });

  it('takes a share away for each wrong choice, but never goes below zero', () => {
    expect(scoreQuestion(multi, [0, 2, 1], 'partial')).toBe(0.5);
    expect(scoreQuestion(multi, [0, 1], 'partial')).toBe(0);
    expect(scoreQuestion(multi, [1, 3], 'partial')).toBe(0);
  });
});

describe('scoreAttempt', () => {
  const exam = EXAMS.find((candidate) => candidate.track === 'associate')!;
  const track = trackById('associate');
  const questions = examQuestions(exam);

  // Answers the first `count` questions correctly, and the rest not at all.
  function attemptWith(count: number): Attempt {
    let attempt = startAttempt(exam, 0);
    for (const question of questions.slice(0, count)) {
      attempt = selectOption(attempt, question.id, question.correctIndexes[0]!, false);
    }
    return attempt;
  }

  it('gives zero for an untouched attempt, which does not pass', () => {
    const score = scoreAttempt(startAttempt(exam, 0), exam);
    expect(score.percent).toBe(0);
    expect(score.passed).toBe(false);
  });

  it('gives 100% for a perfect attempt, in every domain', () => {
    const score = scoreAttempt(attemptWith(questions.length), exam);
    expect(score.percent).toBeCloseTo(100);
    expect(score.passed).toBe(true);
    expect(score.domains.every((domain) => domain.percent === 100)).toBe(true);
  });

  it('passes exactly at the pass mark, and not just below it', () => {
    const atMark = Math.ceil((questions.length * track.passMark) / 100);
    expect(scoreAttempt(attemptWith(atMark), exam).passed).toBe(true);
    expect(scoreAttempt(attemptWith(atMark - 1), exam).passed).toBe(false);
  });

  it('lists domains weakest first, counting each question once', () => {
    const { domains } = scoreAttempt(attemptWith(1), exam);
    expect(domains[0]!.percent).toBe(0);
    expect(domains.reduce((sum, domain) => sum + domain.questions, 0)).toBe(questions.length);
  });

  it('records the time spent on each question', () => {
    const attempt = { ...startAttempt(exam, 0), timeSpentMs: { [questions[0]!.id]: 5000 } };
    expect(scoreAttempt(attempt, exam).questions[0]!.timeMs).toBe(5000);
  });

  it('gives a fixed mock the real exam time per question', () => {
    expect(examDuration(exam)).toBe(
      Math.ceil((track.durationMinutes * questions.length) / track.questionCount),
    );
  });
});

describe('displayPercent', () => {
  it('rounds down, so a near miss does not read as reaching the pass mark', () => {
    expect(displayPercent(74.99)).toBe(74);
    expect(displayPercent(75)).toBe(75);
  });
});

describe('combineDomains', () => {
  it('weights each domain by its number of questions', () => {
    const combined = combineDomains([
      [{ domain: 'a', percent: 100, questions: 1 }],
      [
        { domain: 'a', percent: 0, questions: 3 },
        { domain: 'b', percent: 50, questions: 2 },
      ],
    ]);

    expect(combined).toEqual([
      { domain: 'a', percent: 25, questions: 4 },
      { domain: 'b', percent: 50, questions: 2 },
    ]);
  });
});

describe('formatDuration', () => {
  it('shows seconds, then minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(125_000)).toBe('2m 05s');
  });
});

describe('history', () => {
  const exam = EXAMS[0]!;
  const score: AttemptScore = { percent: 50, passed: false, domains: [], questions: [] };
  const entry = (at: number) =>
    historyEntry({ ...startAttempt(exam, at), finishedAt: at }, exam.name, score);

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps attempts oldest first, and replaces one recorded twice', () => {
    recordInHistory(entry(200));
    recordInHistory(entry(100));
    recordInHistory({ ...entry(200), percent: 90 });

    expect(loadHistory().map((item) => [item.finishedAt, item.percent])).toEqual([
      [100, 50],
      [200, 90],
    ]);
  });

  it('records which track an attempt belongs to', () => {
    expect(entry(1).track).toBe(exam.track);
  });

  it('drops the oldest attempt detail, but keeps scores, when storage is full', () => {
    recordInHistory(entry(100));
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      // Fails until the older attempt's detail has been removed.
      if (value.split('"attempt":{').length > 2) throw new Error('quota');
      realSetItem.call(this, key, value);
    });

    expect(recordInHistory(entry(200))).toBe(true);

    const [older, newer] = loadHistory();
    expect(older!.attempt).toBeNull();
    expect(older!.percent).toBe(50);
    expect(newer!.attempt).not.toBeNull();
  });

  it('remembers which questions were seen, even without the review detail', () => {
    const scored: AttemptScore = {
      ...score,
      questions: scoreAttempt(startAttempt(exam, 1), exam).questions,
    };
    const item = historyEntry({ ...startAttempt(exam, 1), finishedAt: 1 }, exam.name, scored);

    expect(seenQuestionIds([{ ...item, attempt: null }]).size).toBe(exam.questions.length);
    expect(seenQuestionIds([{ ...item, questionIds: undefined }]).size).toBe(0);
  });

  it('survives corrupt data', () => {
    localStorage.setItem('mockmodeler.history', 'not json');
    expect(loadHistory()).toEqual([]);
  });

  it('clears one track, and leaves the other', () => {
    const other = exam.track === 'associate' ? 'developer' : 'associate';
    recordInHistory(entry(100));
    recordInHistory({ ...entry(200), track: other });

    clearHistory(exam.track);

    expect(loadHistory().map((item) => item.track)).toEqual([other]);
  });
});
