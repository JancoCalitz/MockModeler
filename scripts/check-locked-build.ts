// Checks that a site built with CONTENT_PASSWORD holds no readable question content, so a
// mistake can never publish the bank in the open. The Pages workflow runs this before deploying.
//   node scripts/check-locked-build.ts [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateContent } from './lib/validate.ts';

const dir = process.argv[2] ?? 'dist';
const problems: string[] = [];

// Samples of each kind of content: question text, explanations, case studies, notes, and diagrams.
const { bank } = await validateContent('content');
const firstLine = (text: string) =>
  text
    .split('\n')
    .find((line) => line.trim().length > 30)
    ?.trim();
const samples = [
  ...bank.questions.flatMap((question) => [
    firstLine(question.stem),
    firstLine(question.explanation),
  ]),
  ...bank.scenarios.map((scenario) => firstLine(scenario.body)),
  ...bank.notes.map((note) => firstLine(note.summary)),
  ...Object.values(bank.diagrams).map((xml) => /<bpmn:process id="[^"]+"/.exec(xml)?.[0]),
].filter((sample): sample is string => Boolean(sample));

if (samples.length === 0) problems.push('There was no content to look for.');
if (!existsSync(join(dir, 'content.bin'))) problems.push('content.bin is missing.');

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

for (const path of files(dir)) {
  const text = readFileSync(path, 'latin1');
  const found = samples.find((sample) => text.includes(sample));
  if (found) problems.push(`${path} contains readable content: "${found.slice(0, 50)}"`);
}

if (problems.length > 0) {
  console.error('The locked build is not safe to publish:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Locked build checked: ${samples.length} samples, none readable.`);
