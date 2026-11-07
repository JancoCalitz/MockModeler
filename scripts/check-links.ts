// Checks that every docs page the question bank links to exists. This needs the internet, so it is
// not part of the build.
//   npm run content:links
import { validateContent } from './lib/validate.ts';

const { bank } = await validateContent('content');
const urls = [
  ...new Set([
    ...bank.questions.map((question) => question.source.url),
    ...bank.notes.flatMap((note) => note.links.map((link) => link.url)),
  ]),
].sort();

const broken: string[] = [];
const BATCH = 8;
for (let start = 0; start < urls.length; start += BATCH) {
  await Promise.all(
    urls.slice(start, start + BATCH).map(async (url) => {
      try {
        const response = await fetch(url, { redirect: 'follow' });
        // The docs site answers a missing page with its 404 page's status.
        if (!response.ok) broken.push(`${response.status} ${url}`);
      } catch (error) {
        broken.push(`${(error as Error).message} ${url}`);
      }
    }),
  );
}

console.log(`Checked ${urls.length} links.`);
if (broken.length > 0) {
  console.error(`\n${broken.length} broken:`);
  for (const line of broken.sort()) console.error(`  ${line}`);
  process.exit(1);
}
console.log('All links work.');
