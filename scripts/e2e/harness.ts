// What the end-to-end sections share. See scripts/test-e2e.ts.
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';

export const URL = 'http://localhost:4177/MockModeler/';

export interface SectionContext {
  browser: Browser;
  // A browser profile of this section's own, so it starts with nothing saved.
  context: BrowserContext;
}

let failed = 0;
export const failures = () => failed;
export const addFailure = () => {
  failed++;
};

export function check(name: string, passed: boolean, detail = '') {
  if (!passed) failed++;
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `: ${detail}`}`);
}

export const pageErrors: string[] = [];
export function watch(page: Page) {
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) pageErrors.push(`${response.status()} ${response.url()}`);
  });
}

export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: join(dir, `${name}.png`) });
}

export const tile = (page: Page, number: number) =>
  page.getByRole('button', { name: new RegExp(`^Question ${number},`) });

export async function goTo(page: Page, number: number) {
  await tile(page, number).click();
}

export async function answeredCount(page: Page) {
  const labels = await page
    .getByRole('navigation', { name: 'Questions' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? ''));
  return labels.filter((label) => /, answered/.test(label)).length;
}

export function timerSeconds(text: string) {
  const parts = text.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export async function readTimer(page: Page) {
  return timerSeconds((await page.getByRole('timer').textContent()) ?? '');
}

// Moves the saved deadline. The app saves every second, which would overwrite this, so saving is
// also switched off for the rest of this page's life. The next page load reads the new deadline.
export async function setDeadline(page: Page, fromNowMs: number) {
  await page.evaluate((offset) => {
    const saved = JSON.parse(localStorage.getItem('mockmodeler.attempt')!);
    localStorage.setItem(
      'mockmodeler.attempt',
      JSON.stringify({ ...saved, deadline: Date.now() + offset }),
    );
    Storage.prototype.setItem = () => {};
  }, fromNowMs);
}

export async function reloaded(page: Page) {
  await page.reload();
  await page.locator('#root > *').first().waitFor();
}

export async function openApp(page: Page) {
  await page.goto(URL);
  await page.locator('#root > *').first().waitFor();
}

export async function chooseMock(page: Page, id: string) {
  await page.getByRole('combobox', { name: 'Mock exam' }).selectOption(id);
}

export async function submitTest(page: Page) {
  await page.getByRole('button', { name: 'Submit test' }).click();
  await page.getByRole('button', { name: 'Submit final answers' }).click();
  await page.getByRole('heading', { name: /Test submitted|Time is up/ }).waitFor();
}

// Leaves one finished attempt in the history, for sections that need some.
export async function finishQuickAttempt(page: Page) {
  await page.getByRole('button', { name: 'Start test' }).click();
  await submitTest(page);
  await page.getByRole('button', { name: 'Start a new test' }).click();
  await page.getByRole('button', { name: 'Start test' }).waitFor();
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  return page;
}

// Waits for bpmn-js to draw the question's diagram, and reports how many elements it drew.
export async function diagramElements(page: Page) {
  const diagram = page.getByTestId('bpmn-diagram').first();
  await diagram.waitFor({ timeout: 30_000 });
  await diagram.locator('.djs-element').first().waitFor({ timeout: 30_000 });
  return diagram.locator('.djs-element').count();
}
