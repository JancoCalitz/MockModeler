// Works out the right answer to FEEL and DMN questions with a real FEEL engine, so the build can
// check each answer key instead of trusting whoever wrote it.
//
// feelin is not the engine Camunda runs (feel-scala), so a question should stick to behaviour the
// docs describe and both share.
import { evaluate, unaryTest } from 'feelin';
import type { DmnTable } from '../../src/content/schema.ts';

// A value written the way the options write it: "Gold" with quotes, [1, 2], {a: 1}, null.
export function formatFeel(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(formatFeel).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => `${key}: ${formatFeel(item)}`);
    return `{${entries.join(', ')}}`;
  }
  return String(value);
}

export function evaluateFeel(expression: string, context: Record<string, unknown>): string {
  return formatFeel(evaluate(expression, context).value);
}

const NO_RULE = 'no rule matches';
export const HIT_POLICY_VIOLATION = 'hit policy violation';

function matchingRules(table: DmnTable): number[] {
  const matches: number[] = [];
  table.rules.forEach((rule, index) => {
    const allMatch = rule.when.every((cell, column) => {
      if (cell === '-') return true;
      const input = evaluate(table.inputs[column]!.expression, table.given).value;
      return unaryTest(cell, { ...table.given, '?': input }).value === true;
    });
    if (allMatch) matches.push(index);
  });
  return matches;
}

// The table's result, written the way the question should state it.
export function evaluateDmn(table: DmnTable): string {
  const matches = matchingRules(table);
  if (table.ask === 'rules') {
    if (matches.length === 0) return NO_RULE;
    const numbers = matches.map((index) => index + 1).join(', ');
    return `${matches.length === 1 ? 'Rule' : 'Rules'} ${numbers}`;
  }
  const outputs = matches.map((index) => evaluate(table.rules[index]!.then, table.given).value);
  switch (table.hitPolicy) {
    case 'COLLECT':
    case 'RULE ORDER':
      return formatFeel(outputs);
    case 'UNIQUE':
      if (matches.length > 1) return HIT_POLICY_VIOLATION;
      break;
    case 'ANY':
      if (new Set(outputs.map(formatFeel)).size > 1) return HIT_POLICY_VIOLATION;
      break;
    case 'FIRST':
      break;
  }
  return matches.length === 0 ? NO_RULE : formatFeel(outputs[0]);
}
