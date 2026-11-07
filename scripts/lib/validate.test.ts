// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { REFERS_TO_OTHERS } from '../../src/content/option-order.ts';
import { validateContent } from './validate.ts';

// Each test breaks a copy of the real bank in one way, and expects the check to say so.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mockmodeler-content-'));
  cpSync('content', dir, { recursive: true });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

type Item = Record<string, unknown>;

function changeFile(path: string, change: (items: Item[]) => Item[]) {
  const file = join(dir, path);
  writeFileSync(file, stringify(change(parse(readFileSync(file, 'utf8')) as Item[])));
}

const changeQuestion = (path: string, id: string, change: Partial<Item>) =>
  changeFile(path, (items) =>
    items.map((item) => (item.id === id ? { ...item, ...change } : item)),
  );

const errors = async () => (await validateContent(dir)).errors.join('\n');

describe('the real question bank', () => {
  it('is valid', async () => {
    expect((await validateContent('content')).errors).toEqual([]);
  });

  it('never fixes an option order that would always show the right answer first', async () => {
    const { bank } = await validateContent('content');
    const frozen = bank.questions.filter((question) =>
      question.options.some((option) => REFERS_TO_OTHERS.test(option)),
    );
    expect(frozen.map((question) => question.id)).toEqual([]);
  });

  it('has at least 5 questions of each Camunda-specific type', async () => {
    const { bank } = await validateContent('content');
    expect(bank.questions.filter((question) => question.diagram).length).toBeGreaterThanOrEqual(5);
    expect(bank.questions.filter((question) => question.dmn).length).toBeGreaterThanOrEqual(5);
    expect(bank.questions.filter((question) => question.feel).length).toBeGreaterThanOrEqual(5);
  });
});

describe('a malformed bank', () => {
  it('rejects a missing field', async () => {
    changeFile('questions/associate/components.yaml', (items) =>
      items.map((item) => {
        const copy = { ...item };
        delete copy.explanation;
        return copy;
      }),
    );
    expect(await errors()).toContain('explanation');
  });

  it('rejects a duplicate id', async () => {
    changeFile('questions/associate/components.yaml', (items) => [...items, items[0]!]);
    expect(await errors()).toContain('duplicate id');
  });

  it('rejects a domain from outside the blueprint', async () => {
    changeQuestion('questions/associate/components.yaml', 'a-comp-zeebe', { domain: 'cooking' });
    expect(await errors()).toContain('"cooking" is not a domain');
  });

  it('rejects a source for the wrong Camunda version', async () => {
    changeQuestion('questions/associate/components.yaml', 'a-comp-zeebe', {
      source: { url: 'https://docs.camunda.io/docs/8.8/x/', version: '8.8' },
    });
    expect(await errors()).toContain('the exam covers 8.7');
  });

  it('rejects an unknown diagram, or an element it does not have', async () => {
    changeQuestion('questions/associate/bpmn.yaml', 'a-bpmn-default-flow', {
      diagram: { file: 'no-such-diagram', description: 'd' },
    });
    expect(await errors()).toContain('no diagram called "no-such-diagram"');

    changeQuestion('questions/associate/bpmn.yaml', 'a-bpmn-parallel-join', {
      diagram: { file: 'parallel-fulfilment', description: 'd', highlight: ['Nope'] },
    });
    expect(await errors()).toContain('has no element "Nope"');
  });

  it('rejects a diagram no question uses, and one that is not BPMN', async () => {
    writeFileSync(join(dir, 'bpmn/spare.bpmn'), '<not-bpmn');
    const text = await errors();
    expect(text).toContain('spare.bpmn: no question uses it');
    expect(text).toContain('spare.bpmn');
  });
});

describe('answer keys', () => {
  it('rejects a FEEL key that the engine disagrees with', async () => {
    changeQuestion('questions/developer/configuring.yaml', 'd-feel-index', { correctIndexes: [1] });
    expect(await errors()).toContain('FEEL returns 10, but the key says 20');
  });

  it('rejects a DMN key that the table disagrees with', async () => {
    changeQuestion('questions/associate/dmn.yaml', 'a-dmn-first', { correctIndexes: [1] });
    expect(await errors()).toContain('the table gives "Manual"');
  });
});

describe('an unbalanced bank', () => {
  it('fails when a domain is far from its weighting', async () => {
    changeFile('questions/associate/components.yaml', (items) => items.slice(0, 2));
    expect(await errors()).toContain('unbalanced bank: "camunda-components"');
  });

  it('fails when a fixed mock is far from the weighting', async () => {
    const file = join(dir, 'exams/associate-mock-a.yaml');
    const exam = parse(readFileSync(file, 'utf8')) as { questions: string[] };
    exam.questions = exam.questions.filter((id) => !id.startsWith('a-comp-'));
    writeFileSync(file, stringify(exam));
    expect(await errors()).toContain('unbalanced exam: "camunda-components"');
  });

  it('fails when a mock lists a practice-only question', async () => {
    const file = join(dir, 'exams/associate-mock-a.yaml');
    const exam = parse(readFileSync(file, 'utf8')) as { questions: string[] };
    exam.questions[0] = 'a-multi-operate-uses';
    writeFileSync(file, stringify(exam));
    expect(await errors()).toContain('"a-multi-operate-uses" is not allowed');
  });
});
