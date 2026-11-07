import { beforeEach, describe, expect, it } from 'vitest';
import type { Exam, Question } from '../content/schema.ts';
import {
  addTimeSpent,
  applyDeadline,
  clearSelection,
  examSummary,
  finishAttempt,
  formatRemaining,
  isFlagged,
  questionStatus,
  remainingMs,
  selectOption,
  startAttempt,
  toggleFlag,
} from './attempt.ts';
import { loadAttempt, saveAttempt } from './storage.ts';

const NOW = 1_000_000;
const MINUTE = 60_000;

const exam: Exam = {
  id: 'mock-1',
  track: 'associate',
  name: 'Mock',
  questions: ['q1', 'q2'],
  durationMinutes: 90,
  proctoring: { requireFullscreen: false, warnAfterViolations: 2 },
};

const q1 = { id: 'q1' } as Question;
const q2 = { id: 'q2' } as Question;

describe('timer', () => {
  it('sets the deadline from the exam duration, and records the track', () => {
    const attempt = startAttempt(exam, NOW);

    expect(attempt.status).toBe('in_progress');
    expect(attempt.track).toBe('associate');
    expect(remainingMs(attempt, NOW + MINUTE)).toBe(89 * MINUTE);
  });

  it('does not extend the deadline when reloading mid-attempt', () => {
    const attempt = startAttempt(exam, NOW);

    expect(applyDeadline(attempt, NOW + 89 * MINUTE)).toBe(attempt);
    expect(remainingMs(attempt, NOW + 200 * MINUTE)).toBe(0);
  });

  it('expires at the deadline, recording the deadline as the finish time', () => {
    const attempt = startAttempt(exam, NOW);

    const expired = applyDeadline(attempt, NOW + 200 * MINUTE);

    expect(expired.status).toBe('expired');
    expect(expired.finishedAt).toBe(attempt.deadline);
  });

  it('does not turn a submitted attempt into an expired one', () => {
    const submitted = finishAttempt(startAttempt(exam, NOW), 'submitted', NOW + MINUTE);

    expect(applyDeadline(submitted, NOW + 200 * MINUTE).status).toBe('submitted');
  });

  it('formats the time remaining', () => {
    expect(formatRemaining(90 * MINUTE)).toBe('1:30:00');
    expect(formatRemaining(5 * MINUTE + 3000)).toBe('05:03');
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(0)).toBe('00:00');
  });
});

describe('answers', () => {
  it('replaces the choice on a single-select question', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 1, false);
    attempt = selectOption(attempt, 'q1', 3, false);

    expect(attempt.answers.q1!.selected).toEqual([3]);
  });

  it('toggles choices on a multi-select question, keeping them in order', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 3, true);
    attempt = selectOption(attempt, 'q1', 0, true);
    expect(attempt.answers.q1!.selected).toEqual([0, 3]);

    attempt = selectOption(attempt, 'q1', 3, true);
    expect(attempt.answers.q1!.selected).toEqual([0]);
  });

  it('clears a selection but keeps the flag', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 1, false);
    attempt = toggleFlag(attempt, 'q1');
    attempt = clearSelection(attempt, 'q1');

    expect(attempt.answers.q1).toEqual({ selected: [], flagged: true });
    expect(questionStatus(attempt, 'q1')).toBe('unanswered');
  });

  it('cannot change after the attempt has finished', () => {
    const finished = finishAttempt(startAttempt(exam, NOW), 'submitted', NOW);

    expect(selectOption(finished, 'q1', 1, false)).toBe(finished);
    expect(toggleFlag(finished, 'q1')).toBe(finished);
    expect(addTimeSpent(finished, 'q1', 1000)).toBe(finished);
  });
});

describe('summary', () => {
  it('counts answered, unanswered, and flagged questions', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 0, false);
    attempt = toggleFlag(attempt, 'q2');

    expect(isFlagged(attempt, 'q2')).toBe(true);
    expect(examSummary(attempt, [q1, q2])).toEqual({
      total: 2,
      answered: 1,
      unanswered: 1,
      flagged: 1,
    });
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  // The exam is not in the bank, so it has to travel with the attempt, like a random mock.
  const stored = (now = NOW) => startAttempt(exam, now, { generated: true });

  it('restores a saved attempt with its answers', () => {
    const attempt = selectOption(stored(), 'q1', 2, false);
    saveAttempt(attempt);

    expect(loadAttempt(NOW + MINUTE)).toEqual(attempt);
  });

  it('expires a saved attempt if the deadline passed while it was closed', () => {
    saveAttempt(stored());

    expect(loadAttempt(NOW + 200 * MINUTE)!.status).toBe('expired');
  });

  it('ignores corrupt data, older versions, and unknown exams', () => {
    localStorage.setItem('mockmodeler.attempt', 'not json');
    expect(loadAttempt(NOW)).toBeNull();

    saveAttempt({ ...stored(), version: 0 as 1 });
    expect(loadAttempt(NOW)).toBeNull();

    saveAttempt(startAttempt({ ...exam, id: 'gone' }, NOW));
    expect(loadAttempt(NOW)).toBeNull();
  });

  it('removes the attempt when saving nothing', () => {
    saveAttempt(stored());
    saveAttempt(null);

    expect(loadAttempt(NOW)).toBeNull();
  });
});
