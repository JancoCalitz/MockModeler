// End-to-end tests through the real UI, against the production build, served under a subfolder the
// way GitHub Pages does. Each section gets a fresh browser profile, so one can run alone, and one
// failing does not stop the rest.
//
//   npm run test:e2e                    build, then run every section
//   npm run test:e2e -- drills study    build, then run the named sections
//   E2E_CHANNEL=chrome npm run test:e2e   use Chrome, rather than Edge
//   E2E_SCREENSHOTS=some/folder npm run test:e2e
import { chromium, type BrowserContext } from 'playwright-core';
import { preview } from 'vite';
import { attemptFlow } from './e2e/attempt-flow.ts';
import { addFailure, check, failures, pageErrors, type SectionContext } from './e2e/harness.ts';
import { locked } from './e2e/locked.ts';
import { mobile } from './e2e/mobile.ts';
import { offline } from './e2e/offline.ts';
import { drills, study, tracks } from './e2e/practice.ts';
import { screensaver, themes } from './e2e/themes.ts';

const SECTIONS: Record<string, (section: SectionContext) => Promise<void>> = {
  'attempt-flow': attemptFlow,
  tracks,
  study,
  drills,
  offline,
  themes,
  locked,
  mobile,
  screensaver,
};

const chosen = process.argv.slice(2);
const unknown = chosen.filter((name) => !SECTIONS[name]);
if (unknown.length > 0) {
  console.error(`Unknown section: ${unknown.join(', ')}`);
  console.error(`Sections: ${Object.keys(SECTIONS).join(', ')}`);
  process.exit(2);
}
const names = chosen.length > 0 ? chosen : Object.keys(SECTIONS);

const server = await preview({
  base: '/MockModeler/',
  preview: { port: 4177, strictPort: true },
  logLevel: 'error',
});
const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? 'msedge',
  headless: true,
});

// A frozen page must not hang the run forever.
const deadline = setTimeout(() => {
  console.error('Gave up: the run took too long, so a page probably froze.');
  process.exit(2);
}, 15 * 60_000);

async function reportPages(context: BrowserContext) {
  for (const open of context.pages()) {
    const state = await open
      .evaluate(() => ({
        url: location.href,
        heading: document.querySelector('h1')?.textContent,
        status: document.querySelector('[role=status]')?.textContent,
      }))
      .catch((failure: Error) => failure.message);
    console.error('Page state:', JSON.stringify(state));
  }
}

for (const name of names) {
  console.log(`\n=== ${name}`);
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    // Requests that a service worker makes cannot be mocked. Only the offline section needs one.
    serviceWorkers: 'block',
  });
  try {
    await SECTIONS[name]!({ browser, context });
  } catch (error) {
    addFailure();
    console.error(
      `\nSection stopped early: ${String((error as Error).message ?? error).slice(0, 800)}`,
    );
    await reportPages(context);
  }
  await context.close();
}

console.log('\n=== page health');
check(
  'no page errors or failed requests',
  pageErrors.length === 0,
  pageErrors.slice(0, 5).join(' | '),
);

clearTimeout(deadline);
await browser.close();
await server.close();
console.log(failures() === 0 ? '\nAll checks passed.' : `\n${failures()} check(s) failed.`);
process.exit(failures() === 0 ? 0 : 1);
