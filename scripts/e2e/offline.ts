import {
  check,
  chooseMock,
  diagramElements,
  openApp,
  reloaded,
  type SectionContext,
  watch,
} from './harness.ts';

export async function offline({ browser }: SectionContext) {
  console.log('\nWorking offline');
  // Service workers are blocked in other sections, so this one needs its own profile.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
    timeout: 60000,
  });
  check('installs for offline use', true);

  await context.setOffline(true);
  await reloaded(page);
  check(
    'the app opens with no connection',
    await page.getByRole('button', { name: 'Start test' }).isVisible(),
  );

  await chooseMock(page, 'associate-mock-a');
  await page.getByRole('button', { name: 'Start test' }).click();
  check('takes a test, and draws a diagram, with no connection', (await diagramElements(page)) > 5);
  await page.getByRole('radio').first().check();
  await reloaded(page);
  await page.getByRole('timer').waitFor();
  check('keeps an attempt through a reload with no connection', true);
  await context.close();
}
