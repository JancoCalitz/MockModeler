// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { questionSchema, type DmnTable } from '../../src/content/schema.ts';
import { evaluateDmn, evaluateFeel, formatFeel, HIT_POLICY_VIOLATION } from './evaluate.ts';

const table = (overrides: Partial<DmnTable>): DmnTable =>
  questionSchema.parse({
    id: 'q',
    track: 'associate',
    domain: 'd',
    difficulty: 'easy',
    stem: 's',
    options: ['a', 'b', 'c', 'd'],
    correctIndexes: [0],
    explanation: 'e',
    source: { url: 'https://docs.camunda.io/docs/8.7/x/', version: '8.7' },
    dmn: {
      name: 'T',
      hitPolicy: 'UNIQUE',
      inputs: [{ label: 'X', expression: 'x' }],
      output: { label: 'Y', name: 'y' },
      rules: [
        { when: ['> 1'], then: '"big"' },
        { when: ['> 5'], then: '"huge"' },
      ],
      given: { x: 2 },
      ...overrides,
    },
  }).dmn!;

describe('formatFeel', () => {
  it('writes values the way options write them', () => {
    expect(formatFeel('a')).toBe('"a"');
    expect(formatFeel(1.5)).toBe('1.5');
    expect(formatFeel(null)).toBe('null');
    expect(formatFeel([1, 'a'])).toBe('[1, "a"]');
    expect(formatFeel({ a: 1 })).toBe('{a: 1}');
  });
});

describe('evaluateFeel', () => {
  it('indexes lists from 1, and gives null for a missing entry', () => {
    expect(evaluateFeel('[10, 20][1]', {})).toBe('10');
    expect(evaluateFeel('a.b', { a: {} })).toBe('null');
  });
});

describe('evaluateDmn', () => {
  it('returns the one match under Unique, and reports more than one as a violation', () => {
    expect(evaluateDmn(table({}))).toBe('"big"');
    expect(evaluateDmn(table({ given: { x: 9 } }))).toBe(HIT_POLICY_VIOLATION);
  });

  it('takes the first match under First', () => {
    expect(evaluateDmn(table({ hitPolicy: 'FIRST', given: { x: 9 } }))).toBe('"big"');
  });

  it('returns a list under Collect and Rule order', () => {
    const given = { x: 9 };
    expect(evaluateDmn(table({ hitPolicy: 'COLLECT', given }))).toBe('["big", "huge"]');
    expect(evaluateDmn(table({ hitPolicy: 'RULE ORDER', given }))).toBe('["big", "huge"]');
  });

  it('allows several matches under Any only when they agree', () => {
    expect(evaluateDmn(table({ hitPolicy: 'ANY', given: { x: 9 } }))).toBe(HIT_POLICY_VIOLATION);
    const agreeing = [
      { when: ['> 1'], then: '"same"' },
      { when: ['> 5'], then: '"same"' },
    ];
    expect(evaluateDmn(table({ hitPolicy: 'ANY', rules: agreeing, given: { x: 9 } }))).toBe(
      '"same"',
    );
  });

  it('says when no rule matches', () => {
    expect(evaluateDmn(table({ given: { x: 0 } }))).toBe('no rule matches');
  });

  it('names the matching rules when asked for them', () => {
    expect(evaluateDmn(table({ ask: 'rules' }))).toBe('Rule 1');
    expect(evaluateDmn(table({ ask: 'rules', given: { x: 9 } }))).toBe('Rules 1, 2');
  });

  it('treats a dash as matching anything', () => {
    const rules = [{ when: ['-'], then: '1' }];
    expect(evaluateDmn(table({ rules, given: { x: 'anything' } }))).toBe('1');
  });
});
