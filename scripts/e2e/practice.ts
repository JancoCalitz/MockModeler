import type { Page } from 'playwright-core';
import {
  type SectionContext,
  check,
  diagramElements,
  finishQuickAttempt,
  newPage,
  shot,
} from './harness.ts';

const openMode = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Practice modes' }).getByRole('button', { name }).click();

const setTrack = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Certification' }).first().getByRole('button', { name }).click();

export async function tracks({ context }: SectionContext) {
  console.log('\nTwo certifications');
  const page = await newPage(context);
  check(
    'opens on Associate',
    await page.getByRole('heading', { name: 'Camunda Certified Associate' }).isVisible(),
  );
  await setTrack(page, 'Developer');
  check(
    'switches to Developer',
    await page
      .getByRole('heading', { name: 'Camunda Certified Professional - Developer' })
      .isVisible(),
  );
  check('shows its own format', await page.getByText('90 minutes').isVisible());
  await shot(page, 'developer-landing');

  await finishQuickAttempt(page);
  await openMode(page, 'Progress');
  check(
    'Developer progress has the attempt',
    (await page.getByRole('button', { name: /^Review attempt/ }).count()) === 1,
  );
  await setTrack(page, 'Associate');
  check(
    'Associate progress does not',
    await page.getByText('Finish a test to see your progress here.').isVisible(),
  );
}

export async function study({ context }: SectionContext) {
  console.log('\nStudy notes');
  const page = await newPage(context);
  await openMode(page, 'Study notes');
  const domains = page.getByRole('navigation', { name: 'Domains' }).getByRole('link');
  check('lists all six Associate domains', (await domains.count()) === 6);
  check(
    'puts the heaviest domain first',
    (await domains.first().textContent()) === 'Explain Camunda Components',
  );
  await shot(page, 'study');
  const links = page.getByRole('link', { name: 'Operate' });
  check(
    'links to the docs',
    (await links.first().getAttribute('href'))!.includes('docs.camunda.io'),
  );
  await page.getByRole('button', { name: /^Drill Interpret BPMN Diagrams/ }).click();
  await page.getByRole('heading', { name: 'Practice drill' }).waitFor();
  check(
    'starts a drill for that domain',
    await page.getByText(/Interpret BPMN Diagrams$/).isVisible(),
  );
}

export async function drills({ context }: SectionContext) {
  console.log('\nDrills');
  const page = await newPage(context);
  await openMode(page, 'Practice drill');

  await page.getByRole('button', { name: /travel insurance claims/ }).click();
  const caseStudy = page.getByRole('complementary', { name: 'Case study' });
  check('shows a case study beside its question', await caseStudy.isVisible());
  const caseBox = await caseStudy.boundingBox();
  const question = await page.getByRole('radio').first().boundingBox();
  check(
    'keeps the case study to the side on a wide screen',
    (caseBox?.x ?? 0) + (caseBox?.width ?? 0) <= (question?.x ?? 0),
  );
  await shot(page, 'case-study');

  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  check('explains after checking', await page.getByText('Explanation').isVisible());
  await page.getByRole('button', { name: 'End drill' }).click();

  console.log('\nRepeating wrong answers');
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('checkbox', { name: 'Interpret DMN Diagrams' }).check();
  await page.getByLabel('Number of questions').selectOption('50');
  await page.getByRole('button', { name: 'Start drill' }).click();
  let wrong = 0;
  for (;;) {
    const boxes = page.getByRole('checkbox');
    if ((await boxes.count()) > 0) {
      await boxes.first().check();
    } else {
      await page.getByRole('radio').first().check();
    }
    await page.getByRole('button', { name: 'Check answer' }).click();
    if (await page.getByText('✗ Not quite').isVisible()) wrong++;
    const finished = page.getByRole('button', { name: 'See results' });
    if (await finished.isVisible()) {
      await finished.click();
      break;
    }
    await page.getByRole('button', { name: 'Next question' }).click();
  }
  await page.getByRole('heading', { name: /You got \d+ of \d+ right/ }).waitFor();
  check('reports the drill result', true);
  if (wrong > 0) {
    await page.getByRole('button', { name: `Retry the ${wrong} you missed` }).click();
    check(
      'repeats what was missed',
      await page.getByText(new RegExp(`^Question 1 of ${wrong},`)).isVisible(),
    );
    await page.getByRole('button', { name: 'End drill' }).click();
    check(
      'offers the wrong answers on the next visit',
      await page.getByRole('button', { name: /you got wrong/ }).isVisible(),
    );
  }

  console.log('\nFEEL and BPMN in a drill');
  await setTrack(page, 'Developer');
  await page.getByRole('checkbox', { name: 'Modeling' }).check();
  await page.getByRole('button', { name: 'Start drill' }).click();
  check('draws a diagram in a drill', (await diagramElements(page)) > 5);
  await shot(page, 'developer-bpmn');
}
