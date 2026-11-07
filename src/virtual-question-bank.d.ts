// Built from the content folder by scripts/content-plugin.ts.
declare module 'virtual:question-bank' {
  import type { Exam, Note, Question, Scenario, Track } from './content/schema.ts';

  export const tracks: Track[];
  export const questions: Question[];
  export const scenarios: Scenario[];
  export const exams: Exam[];
  export const notes: Note[];
  // BPMN XML, by file name.
  export const diagrams: Record<string, string>;
}

// Whether this build is locked with a password, and where its encrypted questions are.
declare module 'virtual:content-lock' {
  export const contentLock: { locked: boolean; file: string };
}
