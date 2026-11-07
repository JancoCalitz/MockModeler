import { z } from 'zod';

export const TRACK_IDS = ['associate', 'developer'] as const;
export const OPTION_COUNT = 4;

const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase words separated by hyphens');
const trackIdSchema = z.enum(TRACK_IDS);
const text = z.string().trim().min(1, 'must not be empty');
const docsUrl = z
  .string()
  .regex(/^https:\/\/docs\.camunda\.io\/docs\//, 'must be a page on docs.camunda.io');

// One certification: its published format and its blueprint domains.
export const trackSchema = z
  .strictObject({
    id: trackIdSchema,
    code: text,
    name: text,
    camundaVersion: z.string().regex(/^\d+\.\d+$/, 'must look like 8.8'),
    questionCount: z.int().positive(),
    durationMinutes: z.int().positive(),
    passMark: z.number().min(1).max(100),
    readinessTarget: z.number().min(1).max(100),
    // What the real exam allows. A timed mock only uses question types this switches on.
    mock: z.strictObject({ allowMultiSelect: z.boolean(), allowScenario: z.boolean() }),
    // Facts not yet checked against the official blueprint, shown beside the format.
    unconfirmed: z.array(text).default([]),
    domains: z
      .array(z.strictObject({ id: idSchema, label: text, weight: z.number().positive() }))
      .min(1),
  })
  .superRefine((track, ctx) => {
    const total = track.domains.reduce((sum, domain) => sum + domain.weight, 0);
    if (total !== 100) {
      ctx.addIssue({ code: 'custom', path: ['domains'], message: `weights add up to ${total}` });
    }
    if (track.readinessTarget < track.passMark) {
      ctx.addIssue({
        code: 'custom',
        path: ['readinessTarget'],
        message: 'must not be below the pass mark',
      });
    }
  });

// A BPMN file in content/bpmn. The description is for screen readers, and for when it cannot draw.
const diagramSchema = z.strictObject({
  file: idSchema,
  description: text,
  highlight: z.array(z.string()).default([]),
});

export const HIT_POLICIES = ['UNIQUE', 'FIRST', 'ANY', 'COLLECT', 'RULE ORDER'] as const;

// A decision table to show, and the input to evaluate it with. The build evaluates it, to check
// the answer key against a real FEEL engine.
const dmnSchema = z
  .strictObject({
    name: text,
    hitPolicy: z.enum(HIT_POLICIES),
    inputs: z.array(z.strictObject({ label: text, expression: text })).min(1),
    output: z.strictObject({ label: text, name: text }),
    // Each cell of `when` is a FEEL unary test, and `then` is a FEEL expression.
    rules: z.array(z.strictObject({ when: z.array(text), then: text })).min(1),
    given: z.record(z.string(), z.unknown()),
    // What to ask for: the output, or which rules match, as in "Rule 2" or "Rules 1, 3".
    ask: z.enum(['output', 'rules']).default('output'),
    // For an option written in words, the value the build should compute instead of the option.
    expectedResult: z.string().optional(),
  })
  .superRefine((dmn, ctx) => {
    dmn.rules.forEach((rule, index) => {
      if (rule.when.length !== dmn.inputs.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['rules', index, 'when'],
          message: `must have one cell for each of the ${dmn.inputs.length} inputs`,
        });
      }
    });
  });

const feelSchema = z.strictObject({
  expression: text,
  context: z.record(z.string(), z.unknown()).default({}),
});

export const questionSchema = z
  .strictObject({
    id: idSchema,
    track: trackIdSchema,
    domain: idSchema,
    difficulty: z.enum(['easy', 'medium', 'hard']),
    stem: text,
    options: z.array(text).length(OPTION_COUNT, `must have exactly ${OPTION_COUNT} options`),
    multiSelect: z.boolean().default(false),
    correctIndexes: z
      .array(
        z
          .int()
          .min(0)
          .max(OPTION_COUNT - 1),
      )
      .min(1, 'must name at least one correct option'),
    explanation: text,
    // The docs page that backs the answer, and the Camunda version it was written against.
    source: z.strictObject({ url: docsUrl, version: z.string().regex(/^\d+\.\d+$/) }),
    // Set once someone has checked the answer against the docs page.
    reviewed: z.boolean().default(false),
    // A case study this belongs to, shown beside the question.
    scenario: idSchema.optional(),
    diagram: diagramSchema.optional(),
    dmn: dmnSchema.optional(),
    feel: feelSchema.optional(),
  })
  .superRefine((question, ctx) => {
    if (new Set(question.options).size !== question.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'must not repeat an option' });
    }
    if (new Set(question.correctIndexes).size !== question.correctIndexes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctIndexes'],
        message: 'must not repeat an index',
      });
    }
    if (!question.multiSelect && question.correctIndexes.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctIndexes'],
        message: 'must name exactly one option unless multiSelect is true',
      });
    }
    if (question.multiSelect && question.correctIndexes.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctIndexes'],
        message: 'must name at least two options when multiSelect is true',
      });
    }
    const visuals = [question.diagram, question.dmn, question.feel].filter(Boolean);
    if (visuals.length > 1) {
      ctx.addIssue({ code: 'custom', message: 'can only have one of diagram, dmn, and feel' });
    }
  });

export const scenarioSchema = z.strictObject({
  id: idSchema,
  track: trackIdSchema,
  title: text,
  body: text,
});

export const examSchema = z.strictObject({
  id: idSchema,
  track: trackIdSchema,
  name: text,
  questions: z.array(idSchema).min(1, 'must list at least one question'),
  // Left out of a fixed mock, whose time comes from the track's minutes per question.
  durationMinutes: z.int().positive().optional(),
  proctoring: z
    .strictObject({
      // Whether the start page ticks "Require full screen" by default.
      requireFullscreen: z.boolean().default(false),
      warnAfterViolations: z.int().positive().default(2),
    })
    .prefault({}),
});

// Study notes for one blueprint domain.
export const noteSchema = z.strictObject({
  track: trackIdSchema,
  domain: idSchema,
  summary: text,
  keyPoints: z.array(text).min(1),
  links: z.array(z.strictObject({ title: text, url: docsUrl })).min(1),
});

export type TrackId = (typeof TRACK_IDS)[number];
export type Track = z.infer<typeof trackSchema>;
export type Domain = Track['domains'][number];
export type Question = z.infer<typeof questionSchema>;
export type DmnTable = NonNullable<Question['dmn']>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Exam = z.infer<typeof examSchema>;
export type Note = z.infer<typeof noteSchema>;
