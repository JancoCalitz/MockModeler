import { validateContent } from './lib/validate.ts';
import { allowedInMock } from '../src/content/mock-rules.ts';

const report = await validateContent(process.argv[2] ?? 'content');
const { questions, reviewed, feelKeysChecked, dmnKeysChecked, diagrams } = report.counts;

console.log(
  `Checked ${questions} questions, ${diagrams} BPMN diagrams, ${feelKeysChecked} FEEL keys, and ${dmnKeysChecked} DMN keys.`,
);
console.log(`Reviewed against the docs: ${reviewed} of ${questions}.`);

for (const track of report.bank.tracks) {
  const pool = report.bank.questions.filter((question) => allowedInMock(question, track));
  const full = Math.floor(pool.length / track.questionCount);
  console.log(
    `${track.id}: ${pool.length} mock questions, enough for ${full} full ${track.questionCount}-question mock(s) without repeats.`,
  );
}

if (report.errors.length > 0) {
  console.error(`\nFound ${report.errors.length} error(s):`);
  for (const error of report.errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log('\nContent is valid.');
