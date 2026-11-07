import { diagrams, exams, notes, questions, scenarios, tracks } from 'virtual:question-bank';
import { mockMinutes } from './mock-rules.ts';
import type { Exam, Note, Question, Scenario, Track, TrackId } from './schema.ts';

// The build checks the question bank, and turns it into JavaScript. See scripts/content-plugin.ts.

export const TRACKS: Track[] = tracks;
export const QUESTIONS: Question[] = questions;
export const EXAMS: Exam[] = exams;

const questionById = new Map(QUESTIONS.map((question) => [question.id, question]));
const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

export function trackById(id: TrackId): Track {
  return TRACKS.find((track) => track.id === id)!;
}

export function questionsFor(track: TrackId): Question[] {
  return QUESTIONS.filter((question) => question.track === track);
}

export function examsFor(track: TrackId): Exam[] {
  return EXAMS.filter((exam) => exam.track === track);
}

export function notesFor(track: TrackId): Note[] {
  return notes.filter((note) => note.track === track);
}

export function scenariosFor(track: TrackId): Scenario[] {
  return scenarios.filter((scenario) => scenario.track === track);
}

export function findQuestion(id: string | undefined): Question | undefined {
  return id === undefined ? undefined : questionById.get(id);
}

export function findScenario(id: string | undefined): Scenario | undefined {
  return id === undefined ? undefined : scenarioById.get(id);
}

export function diagramXml(file: string): string | undefined {
  return diagrams[file];
}

export function domainLabel(track: Track, domain: string): string {
  return track.domains.find((candidate) => candidate.id === domain)?.label ?? domain;
}

// A question that has since left the bank is skipped, so an old attempt can still be opened.
export function examQuestions(exam: Exam): Question[] {
  return exam.questions.flatMap((id) => {
    const question = questionById.get(id);
    return question ? [question] : [];
  });
}

export function examDuration(exam: Exam): number {
  return exam.durationMinutes ?? mockMinutes(trackById(exam.track), exam.questions.length);
}

// A random exam is not in the bank, so its attempt carries its own copy.
export function examFor(attempt: { examId: string; generatedExam?: Exam }): Exam | undefined {
  return attempt.generatedExam ?? EXAMS.find((exam) => exam.id === attempt.examId);
}
