# Camunda Certification Practice App: Build Plan

Goal: a browser-only practice simulator for the Camunda 8 Associate and Developer exams, forked
from MockerRank. Both tracks have mock exams, study notes, and practice drills. See
[PROGRESS.md](PROGRESS.md) for what is done.

## Phase 0: Spec and eligibility (1-2 days)

- [ ] Get the Associate exam blueprint and sample questions from Camunda Academy
- [ ] Record question count, time limit, pass mark, question types, and whether you can go back to
      earlier questions
- [ ] Confirm you are allowed to sit the exam (it was customer/partner-only when last checked)
- [x] Decide the target exams: Associate and Developer together
- Done when: one-page format spec plus a list of blueprint domains with weightings

## Phase 1: Fork and strip (1-2 days)

- [x] Fork MockerRank into a new repo with its own git identity
- [x] Remove coding parts: WebAssembly runtimes, Monaco, coding gym, hidden tests
- [x] Keep themes, exam engine, reports, mobile layout, lock screen, deployment
- Done when: app builds and runs with an empty question bank

## Phase 2: Question schema and validation (2-3 days)

- [x] Define the YAML schema, checked at build time: domain, difficulty, type (single / multi /
      scenario), options, correct answers, explanation, source (Camunda docs page + version)
- [x] Add scenario support (one case study with several questions)
- [x] Add a build check comparing questions per domain to blueprint weightings
- Done when: the build fails on a malformed or unbalanced bank

## Phase 3: Exam engine changes (2-3 days)

- [x] Set format, timer and pass mark to the blueprint
- [x] Add multi-select scoring
- [x] Add a scenario view that keeps the case text beside its questions
- [x] Keep fixed mock exams and random exams weighted by domain
- Done when: a full timed mock runs end to end, including the refresh-safe timer

## Phase 4: Camunda-specific question types (4-7 days, optional but valuable)

- [x] BPMN viewer: embed bpmn-js (read-only) for "what happens at this gateway?" / "what is wrong
      with this model?"
- [x] FEEL evaluator: use a JS FEEL engine such as feelin so "what does this expression return?"
      keys are checked automatically
- [x] DMN tables: show a table and an input, ask for the output
- Done when: each type has at least 5 working questions

## Phase 5: Question bank (longest phase, ongoing)

- [ ] Write original questions only, by blueprint domain (never use leaked or braindump questions)
- [ ] Target about 150 for Associate, more for Developer; start smaller and review well
- [ ] Review each question against the docs (Camunda 8 behaviour changes between versions)
- Done when: every domain meets its weighting and 3+ distinct mock exams run without repeats

## Phase 6: Reports and practice modes (2-3 days)

- [x] Report: score by domain, time per question, explanations, review every question
- [x] Readiness page with a target (e.g. 80%)
- [x] Topic drill that repeats wrong answers, plus a "weak areas" mock

## Phase 7: AI tutor (2 days, optional)

- [ ] Reuse guardrails: own API key, never send answers to the model, second AI checks each reply
- [ ] "Explain the concept" tutor that refuses to give the answer to the current question

## Phase 8: Security, testing and deploy (2-3 days)

- [x] Encrypt the bank at build time; use a private content repo or private repo
- [x] Unit tests: scoring, multi-select logic
- [x] Playwright end-to-end: a full attempt, themes, lock screen, mobile, offline
- [ ] Deploy via GitHub Pages Actions

## Suggested order for an early usable result

Phases 0, 1, 2, 3 plus about 30 questions from Phase 5 give a working mock exam. Then alternate
Phase 5 with Phases 4 and 6 so you can study while you build.
