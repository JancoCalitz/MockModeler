import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  type SectionContext,
  answeredCount,
  check,
  chooseMock,
  diagramElements,
  goTo,
  openApp,
  readTimer,
  reloaded,
  setDeadline,
  shot,
  submitTest,
  tile,
  watch,
} from './harness.ts';

const MOCK = 'associate-mock-a';
const QUESTIONS = (
  parse(readFileSync(`content/exams/${MOCK}.yaml`, 'utf8')) as { questions: string[] }
).questions.length;

// The first question in this mock has a diagram, and the fourth has a decision table.
export async function attemptFlow({ context }: SectionContext) {
  console.log('\nThe start page');
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  check('shows the real exam format', await page.getByText('75 minutes').isVisible());
  await shot(page, '1-landing');
  await chooseMock(page, MOCK);
  check('shows the time for this mock', await page.getByText('25 minutes').isVisible());
  await page.getByRole('button', { name: 'Start test' }).click();
  check('starts the timer', (await readTimer(page)) > 24 * 60);

  console.log('\nQuestion types');
  check('draws a BPMN diagram', (await diagramElements(page)) > 5);
  await shot(page, '2-bpmn');
  const box = await page.getByTestId('bpmn-diagram').boundingBox();
  check('the diagram has room on screen', (box?.height ?? 0) > 200);
  await goTo(page, 4);
  check('shows a decision table', await page.getByRole('table').isVisible());
  await shot(page, '3-dmn');

  console.log('\nAnswering');
  await goTo(page, 1);
  await page.getByRole('radio').nth(1).check();
  check('marks the question answered', (await answeredCount(page)) === 1);
  await page.getByRole('button', { name: 'Clear selection' }).click();
  check('clears a selection', (await answeredCount(page)) === 0);

  for (let number = 1; number <= QUESTIONS; number++) {
    await goTo(page, number);
    await page
      .getByRole('radio')
      .nth(number % 4)
      .check();
  }
  check('answers every question', (await answeredCount(page)) === QUESTIONS);
  await page.keyboard.press('f');
  check(
    'flags with a shortcut',
    /flagged/.test((await tile(page, QUESTIONS).getAttribute('aria-label')) ?? ''),
  );

  console.log('\nRefreshing and closing the tab');
  await goTo(page, 13);
  const before = await readTimer(page);
  await page.waitForTimeout(1500);
  await reloaded(page);
  await page.getByRole('timer').waitFor();
  const after = await readTimer(page);
  check(
    'refresh does not reset the timer',
    after < before && after > before - 30,
    `${before} -> ${after}`,
  );
  check('refresh keeps the answers', (await answeredCount(page)) === QUESTIONS);
  check(
    'refresh returns to the same question',
    (await tile(page, 13).getAttribute('aria-current')) === 'true',
  );
  check(
    'refresh keeps the selected option',
    await page
      .getByRole('radio')
      .nth(13 % 4)
      .isChecked(),
  );

  await page.close();
  const reopened = await context.newPage();
  watch(reopened);
  await openApp(reopened);
  await reopened.getByRole('timer').waitFor();
  check('closing the tab keeps the answers', (await answeredCount(reopened)) === QUESTIONS);
  check('closing the tab does not reset the timer', (await readTimer(reopened)) <= after);

  console.log('\nThe report');
  await submitTest(reopened);
  check(
    'reports what was answered',
    await reopened.getByText(`You answered ${QUESTIONS} of ${QUESTIONS} questions`).isVisible(),
  );
  check(
    'reports by domain',
    await reopened.getByRole('list', { name: 'Score by domain' }).isVisible(),
  );
  check('compares with the pass mark', await reopened.getByText(/75% pass mark/).isVisible());
  const firstReview = reopened.getByRole('listitem').filter({ hasText: /^1\./ });
  await firstReview.locator('summary').click();
  check('draws the diagram in the review', (await diagramElements(reopened)) > 5);
  check('shows the explanation', await firstReview.getByText('Explanation').isVisible());
  check(
    'links to the docs',
    (await firstReview
      .getByRole('link', { name: 'Read more in the Camunda docs' })
      .getAttribute('href'))!.startsWith('https://docs.camunda.io/docs/8.7/'),
  );
  await shot(reopened, '4-results');
  await reloaded(reopened);
  check(
    'stays finished after a refresh',
    await reopened.getByRole('heading', { name: 'Test submitted' }).isVisible(),
  );

  console.log('\nExpiry');
  await reopened.getByRole('button', { name: 'Start a new test' }).click();
  await chooseMock(reopened, MOCK);
  await reopened.getByRole('button', { name: 'Start test' }).click();
  await reopened.getByRole('radio').first().check();
  await setDeadline(reopened, 3000);
  await reloaded(reopened);
  await reopened.getByRole('timer').waitFor();
  await reopened.getByRole('heading', { name: 'Time is up' }).waitFor({ timeout: 8000 });
  check('submits automatically at the deadline', true);
  check(
    'keeps the answers from the expired attempt',
    await reopened.getByText(`You answered 1 of ${QUESTIONS} questions`).isVisible(),
  );

  await reopened.getByRole('button', { name: 'Start a new test' }).click();
  await reopened.getByRole('button', { name: 'Start test' }).click();
  await setDeadline(reopened, -1000);
  await reopened.close();
  const later = await context.newPage();
  watch(later);
  await openApp(later);
  check(
    'an attempt that ran out while closed is finished on return',
    await later.getByRole('heading', { name: 'Time is up' }).isVisible(),
  );

  console.log('\nProgress');
  await later.getByRole('button', { name: 'View progress' }).click();
  await later.getByRole('heading', { name: 'Your progress' }).waitFor();
  check(
    'lists every attempt',
    (await later.getByRole('button', { name: /^Review attempt/ }).count()) === 3,
  );
  await shot(later, '5-progress');
  await later.getByRole('button', { name: 'Review attempt 1' }).click();
  check(
    'reopens a past attempt',
    await later.getByRole('heading', { name: 'Test submitted' }).isVisible(),
  );
  await later.getByRole('button', { name: 'Back to progress' }).click();
  await later.getByRole('button', { name: 'Take a weak areas mock' }).click();
  await later.getByRole('timer').waitFor();
  check('starts a weak areas mock', true);
}
