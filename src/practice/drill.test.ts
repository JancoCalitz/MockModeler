import { beforeEach, describe, expect, it } from 'vitest';
import { exportProgress, importProgress } from '../attempt/backup.ts';
import { startAttempt } from '../attempt/attempt.ts';
import { clearHistory, historyEntry, loadHistory, recordInHistory } from '../attempt/history.ts';
import { EXAMS, findQuestion, questionsFor } from '../content/bank.ts';
import {
  checkAnswer,
  chooseOption,
  drillSummary,
  isCorrect,
  loadDrill,
  nextQuestion,
  retryQuestions,
  saveDrill,
  scenarioDrill,
  startDrill,
  weakestDomains,
} from './drill.ts';

const bank = questionsFor('associate');
const single = bank.find((question) => !question.multiSelect)!;
const multi = bank.find((question) => question.multiSelect)!;
const COMPONENTS = 'camunda-components';
const BPMN = 'interpret-bpmn';

describe('startDrill', () => {
  it('only uses the chosen domains, up to the requested count', () => {
    const drill = startDrill('associate', [COMPONENTS, BPMN], 5);

    expect(drill.questionIds).toHaveLength(5);
    for (const id of drill.questionIds) {
      expect([COMPONENTS, BPMN]).toContain(findQuestion(id)!.domain);
    }
  });

  it('uses what exists when fewer questions are available than requested', () => {
    const inDomain = bank.filter((question) => question.domain === BPMN);
    expect(startDrill('associate', [BPMN], 1000).questionIds).toHaveLength(inDomain.length);
    expect(startDrill('associate', [], 10).questionIds).toEqual([]);
  });

  it('does not repeat a question, or cross into the other track', () => {
    const { questionIds } = startDrill('associate', [COMPONENTS, BPMN], 15);

    expect(new Set(questionIds).size).toBe(15);
    expect(questionIds.every((id) => findQuestion(id)!.track === 'associate')).toBe(true);
    expect(startDrill('developer', [COMPONENTS], 5).questionIds).toEqual([]);
  });
});

describe('scenarioDrill', () => {
  it('keeps a case study together, in the order it was written', () => {
    const { questionIds } = scenarioDrill('associate', 'a-case-claims');

    expect(questionIds).toEqual(
      bank.filter((question) => question.scenario === 'a-case-claims').map(({ id }) => id),
    );
    expect(questionIds.length).toBeGreaterThan(1);
  });
});

describe('answering', () => {
  it('replaces the choice on a single-select question, and toggles on multi-select', () => {
    let drill = startDrill('associate', [single.domain], 1);
    drill = chooseOption(drill, single, 0);
    drill = chooseOption(drill, single, 2);
    expect(drill.answers[single.id]!.selected).toEqual([2]);

    drill = chooseOption(drill, multi, 3);
    drill = chooseOption(drill, multi, 0);
    drill = chooseOption(drill, multi, 3);
    expect(drill.answers[multi.id]!.selected).toEqual([0]);
  });

  it('cannot check with nothing chosen, and cannot change after checking', () => {
    let drill = startDrill('associate', [single.domain], 1);
    expect(checkAnswer(drill, single.id)).toBe(drill);

    drill = checkAnswer(chooseOption(drill, single, 0), single.id);
    expect(drill.answers[single.id]!.checked).toBe(true);
    expect(chooseOption(drill, single, 1)).toBe(drill);
  });

  it('needs exactly the right choices on a multi-select question', () => {
    let drill = retryQuestions('associate', [multi.id]);
    for (const option of multi.correctIndexes.slice(0, -1)) {
      drill = chooseOption(drill, multi, option);
    }
    expect(isCorrect(drill, multi)).toBe(false);

    drill = chooseOption(drill, multi, multi.correctIndexes.at(-1)!);
    expect(isCorrect(drill, multi)).toBe(true);
  });
});

describe('finishing', () => {
  it('finishes after the last question, and summarises what was missed', () => {
    const first = single;
    const second = bank.find((question) => !question.multiSelect && question.id !== first.id)!;
    let drill = retryQuestions('associate', [first.id, second.id], () => 0.999);
    drill = chooseOption(drill, first, first.correctIndexes[0]!);
    drill = chooseOption(drill, second, (second.correctIndexes[0]! + 1) % 4);

    drill = nextQuestion(drill);
    expect(drill.finished).toBe(false);
    drill = nextQuestion(drill);
    expect(drill.finished).toBe(true);

    expect(drillSummary(drill)).toEqual({ total: 2, correct: 1, missedIds: [second.id] });
  });

  it('counts a question that was skipped as missed', () => {
    expect(drillSummary(retryQuestions('associate', [single.id])).missedIds).toEqual([single.id]);
  });
});

describe('weakestDomains', () => {
  const entry = (domain: string, percent: number) =>
    ({ domains: [{ domain, percent, questions: 4 }] }) as Parameters<
      typeof weakestDomains
    >[0][number];

  it('lists the weakest first, and leaves out what is already perfect', () => {
    expect(weakestDomains([entry('a', 90), entry('b', 20), entry('c', 100)], 3)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('saved drills', () => {
  beforeEach(() => localStorage.clear());

  it('round trips, and can be removed', () => {
    const drill = startDrill('associate', [BPMN], 3);
    saveDrill('associate', drill);
    expect(loadDrill('associate')).toEqual(drill);

    saveDrill('associate', null);
    expect(loadDrill('associate')).toBeNull();
  });

  it('keeps a separate drill for each track', () => {
    saveDrill('associate', startDrill('associate', [BPMN], 3));
    expect(loadDrill('developer')).toBeNull();
  });

  it('ignores damaged data, and a drill whose questions have left the bank', () => {
    localStorage.setItem('mockmodeler.drill.associate', 'not json');
    expect(loadDrill('associate')).toBeNull();

    saveDrill('associate', retryQuestions('associate', ['no-such-question']));
    expect(loadDrill('associate')).toBeNull();
  });
});

describe('progress backups', () => {
  const exam = EXAMS[0]!;
  const score = { percent: 70, passed: false, domains: [], questions: [] };

  beforeEach(() => localStorage.clear());

  it('restores progress into an empty browser', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));
    const backup = exportProgress();
    clearHistory(exam.track);

    expect(importProgress(backup)).toEqual({ ok: true, imported: 1 });
    expect(loadHistory()[0]!.percent).toBe(70);
  });

  it('adds to existing progress, and importing twice does not duplicate', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));
    const backup = exportProgress();
    recordInHistory(historyEntry({ ...startAttempt(exam, 9), finishedAt: 9 }, exam.name, score));

    importProgress(backup);
    importProgress(backup);

    expect(loadHistory()).toHaveLength(2);
  });

  it('rejects other files without changing anything', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));

    expect(importProgress('not json')).toMatchObject({ ok: false });
    expect(importProgress('{"format":"other","entries":[]}')).toMatchObject({ ok: false });
    expect(
      importProgress(
        JSON.stringify({
          format: 'mockmodeler-progress',
          entries: [{ id: 'x', percent: 900 }],
          missed: { questions: {}, attempts: [] },
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(loadHistory()).toHaveLength(1);
  });
});
