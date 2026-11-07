# Progress

Status as of 7 November 2026. The plan is in [PLAN.md](PLAN.md).

## Done

### Phase 0: Exam format, in part

[docs/exam-format.md](docs/exam-format.md) records the format and domain weightings of both exams,
with sources. The figures come from search excerpts, as Camunda's Academy site refuses automated
reading. Still to do by hand: read the official blueprints, and confirm eligibility.

### Phase 1: Fork and strip

A fresh repository, with none of MockerRank's history. Removed: the code runners, Monaco, the
coding gym, coding questions, the AI assistant, and question packs. Kept: the exam engine and
timer, themes, reports, the lock screen, offline use, and the Pages deployment. Progress backups
stay.

The AI assistant can be brought back from MockerRank for Phase 7.

### Phase 2: Question format and checks

- The format is in `src/content/schema.ts`, and described in [content/README.md](content/README.md).
- `scripts/lib/validate.ts` runs in every build, and fails it for: a schema error, a duplicate id, a
  domain outside the blueprint, a docs link for the wrong Camunda version, an unknown diagram or
  element, a FEEL or DMN answer key the engine disagrees with, a bank or fixed mock whose domains
  stray from the weightings, a mock that lists a practice-only question, and a domain with no notes.
- `npm run content:links` checks every docs link. All 61 work.

### Phase 3: Exam engine

- Two tracks, switched at the top of every screen, each with its own history, drill, and notes.
- Mocks use the real exam's question count, time, and pass mark. While the bank is smaller than the
  exam, a random mock uses every available question, with the real exam's time per question.
- Timed mocks use single-answer questions only, as the Associate exam does. The Developer exam's
  question types are unconfirmed, so it does the same. A track's `mock` settings turn on
  multi-select or case-study questions.
- Random mocks are weighted by domain, and avoid questions already seen. Each track also has two
  fixed 20-question mocks.
- Case studies show beside their questions, or above them on a narrow screen.

### Phase 4: Camunda question types

| Type         | Questions | How the answer is checked                      |
| ------------ | --------: | ---------------------------------------------- |
| BPMN diagram |        13 | By hand. The build checks the diagram and ids  |
| DMN table    |         9 | The build evaluates the table with feelin      |
| FEEL         |         5 | The build evaluates the expression with feelin |

Eight diagrams, in `content/bpmn`, drawn with bpmn-js. They load only when a question shows one.

### Phase 5: Starter question bank

| Track     | Mock questions | Practice only | Total |
| --------- | -------------: | ------------: | ----: |
| Associate |             40 |             6 |    46 |
| Developer |             40 |             6 |    46 |

All original, each linked to a docs page for the track's version. Facts were checked against the
docs pages while writing, but **no question is marked `reviewed` yet**: that is for a person to do.
The bank covers 40 of the 60 questions in a full mock, so it has no full-length mock yet, and is
well short of the 3 non-repeating mocks the plan asks for.

### Phase 6: Reports and practice

- Results: score, pass or fail against the real pass mark, score by domain, time per question, and a
  review of every question with its explanation and docs link.
- Progress: readiness against an 80% target, weakest domains, and attempt history, per track.
- Drills by domain, case-study drills, retrying wrong answers, and a weak areas mock.
- Study notes for all 14 domains.

### Tests

- 126 unit tests, including scoring, multi-select, the generator's weighting, the FEEL and DMN
  evaluator, and the content check failing on broken copies of the bank.
- `npm run test:e2e` covers a full attempt, the refresh-safe timer, expiry, both tracks, study
  notes, drills, case studies, themes, the locked build, offline use, and phones and tablets. All
  checks pass in Microsoft Edge.

## Next

1. Read the official blueprints, confirm the figures in `content/tracks/`, and check eligibility.
2. Review each question against its docs page, and set `reviewed: true`.
3. Grow both banks to at least 60 mock questions each, then towards 150 or more, keeping to the
   weightings.
4. Set up GitHub Pages, as the README describes.
5. Phase 7, the AI tutor, if wanted.
