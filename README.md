# MockModeler

A browser-only practice app for two Camunda 8 certifications: the **Camunda Certified Associate**
(C8-CA, Camunda 8.7) and the **Camunda Certified Professional - Developer** (C8-CP-DV, Camunda 8.8).
For each one, it has timed mock exams, study notes for every blueprint domain, and untimed practice
drills.

It is an independent study tool, not affiliated with Camunda. Every question is original. None
comes from a real exam, a "braindump", or a leaked question.

See [PLAN.md](PLAN.md) for the build plan, [docs/exam-format.md](docs/exam-format.md) for what is
known about each exam, and [PROGRESS.md](PROGRESS.md) for current status.

## Use it

With [Node.js](https://nodejs.org/) 24 or later installed, run:

```sh
npm install
npm start
```

Then open <http://localhost:8080>. Use the **Associate** and **Developer** switch at the top to
choose a certification.

## What it does

- **Mock exam:** a timed test in the real exam's format: single-answer multiple choice, weighted
  across the blueprint domains. Choose a random mock, a weak areas mock that leans towards the
  domains you score worst in, or a fixed mock. The timer survives a refresh or a closed tab.
- **Study notes:** a summary and key points for every blueprint domain, heaviest first, with links
  to the Camunda docs and a drill for that domain.
- **Practice drill:** untimed questions by domain, with the answer and explanation after each. It
  includes question types the mocks leave out: case studies and select-all-that-apply questions. It
  offers the questions you got wrong until you get them right.
- **Progress:** your score against the pass mark and an 80% readiness target, your weakest domains,
  and every attempt to review.

Questions can show a **BPMN diagram** (drawn with bpmn-js, which you can drag and zoom), a **DMN
decision table**, or a **FEEL expression**. The build works out the answer to every FEEL and DMN
question with a FEEL engine, so a wrong answer key cannot be published.

## Phones and tablets

Every screen fits phones and tablets. On a phone, pinch or drag a diagram to see its detail.

## Working offline

After your first visit, the app opens and runs with no internet connection.

## Share it on GitHub Pages

The published site is public on most GitHub plans, so its questions are locked with a password you
share with your group:

1. In the repository's settings, under **Secrets and variables → Actions**, add a secret called
   `CONTENT_PASSWORD`. Use a long password, such as four or five random words.
2. Under **Variables** on the same page, add `DEPLOY_PAGES`, set to `true`.
3. Under **Pages**, set the source to **GitHub Actions**.

Each push to `main` then deploys the site. The build encrypts every question, note, and diagram with
the password, and refuses to deploy if any of them would be readable. Visitors enter the password
once, and can keep their device unlocked. Local builds, such as `npm start`, are not locked.

Anyone you give the password to can pass it on, or copy the questions once unlocked.

## Your data

Attempts are stored in your browser, and clearing its data deletes them. Under **Backups**, you can
save your progress to a file and restore it.

## Add questions

[content/README.md](content/README.md) describes the question format. The build checks every
question, and fails if one is malformed, if its answer key disagrees with the FEEL engine, or if
the bank's domains drift too far from the blueprint weightings.

## Develop

| Command                    | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `npm run dev`              | Start the dev server                          |
| `npm test`                 | Run unit tests                                |
| `npm run content:validate` | Check the question bank                       |
| `npm run content:links`    | Check every docs link (needs the internet)    |
| `npm run lint`             | Lint with ESLint                              |
| `npm run typecheck`        | Type-check                                    |
| `npm run format`           | Format with Prettier                          |
| `npm run build`            | Build the static site to `dist`               |
| `npm run test:e2e`         | Take attempts in Microsoft Edge, on the build |

## Layout

| Path          | Contents                                                      |
| ------------- | ------------------------------------------------------------- |
| `src`         | React, TypeScript, and Tailwind app                           |
| `src/content` | Question format, mock rules, and the random mock generator    |
| `content`     | Tracks, questions, case studies, notes, mocks, and BPMN files |
| `scripts`     | The content check, build plugins, and browser tests           |

Forked from [MockerRank](https://github.com/JancoCalitz/MockerRank), keeping its exam engine,
themes, reports, lock screen, and deployment.
