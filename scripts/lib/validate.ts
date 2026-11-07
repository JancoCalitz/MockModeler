import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BpmnModdle } from 'bpmn-moddle';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { allowedInMock, unbalancedDomains } from '../../src/content/mock-rules.ts';
import {
  examSchema,
  noteSchema,
  questionSchema,
  scenarioSchema,
  trackSchema,
  type Exam,
  type Note,
  type Question,
  type Scenario,
  type Track,
} from '../../src/content/schema.ts';
import { evaluateDmn, evaluateFeel } from './evaluate.ts';

export interface ContentBank {
  tracks: Track[];
  questions: Question[];
  scenarios: Scenario[];
  exams: Exam[];
  notes: Note[];
  diagrams: Record<string, string>;
}

export interface ValidationReport {
  errors: string[];
  bank: ContentBank;
  counts: {
    questions: number;
    reviewed: number;
    feelKeysChecked: number;
    dmnKeysChecked: number;
    diagrams: number;
  };
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (text, part) =>
      typeof part === 'number' ? `${text}[${part}]` : `${text}${text ? '.' : ''}${String(part)}`,
    '',
  );
}

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return yamlFiles(path);
      return /\.ya?ml$/.test(name) ? [path] : [];
    });
}

// Each item is checked separately, so one bad question leaves the rest for the later checks. A
// failure here stops the build, as this runs from scripts/content-plugin.ts as well.
export async function validateContent(contentDir: string): Promise<ValidationReport> {
  const errors: string[] = [];
  const display = (path: string) => relative(process.cwd(), path).replaceAll('\\', '/');

  function readFolder(folder: string): { file: string; data: unknown }[] {
    return yamlFiles(join(contentDir, folder)).flatMap((path) => {
      const file = display(path);
      try {
        return [{ file, data: parseYaml(readFileSync(path, 'utf8')) as unknown }];
      } catch (error) {
        errors.push(`${file}: invalid YAML: ${(error as Error).message}`);
        return [];
      }
    });
  }

  function check<T>(file: string, schema: z.ZodType<T>, data: unknown, at: PropertyKey[] = []) {
    const parsed = schema.safeParse(data);
    if (parsed.success) return [parsed.data];
    for (const issue of parsed.error.issues) {
      errors.push(`${file}: ${formatPath([...at, ...issue.path]) || '(file)'} ${issue.message}`);
    }
    return [];
  }

  function readList<T>(folder: string, schema: z.ZodType<T>) {
    return readFolder(folder).flatMap(({ file, data }) => {
      if (!Array.isArray(data)) {
        errors.push(`${file}: must be a list`);
        return [];
      }
      return data.flatMap((item, index) =>
        check(file, schema, item, [index]).map((parsed) => ({ file, item: parsed })),
      );
    });
  }

  const tracks = readFolder('tracks').flatMap(({ file, data }) => check(file, trackSchema, data));
  const questions = readList('questions', questionSchema);
  const scenarios = readList('scenarios', scenarioSchema);
  const notes = readList('notes', noteSchema);
  const exams = readFolder('exams').flatMap(({ file, data }) =>
    check(file, examSchema, data).map((item) => ({ file, item })),
  );

  const seen = new Map<string, string>();
  for (const { file, item } of [...questions, ...scenarios, ...exams]) {
    const first = seen.get(item.id);
    if (first) errors.push(`${file}: duplicate id "${item.id}", already used in ${first}`);
    else seen.set(item.id, file);
  }

  const trackOf = new Map(tracks.map((track) => [track.id, track]));
  const scenarioOf = new Map(scenarios.map(({ item }) => [item.id, item]));
  const questionOf = new Map(questions.map(({ item }) => [item.id, item]));

  const diagrams: Record<string, string> = {};
  const bpmnDir = join(contentDir, 'bpmn');
  if (existsSync(bpmnDir)) {
    for (const name of readdirSync(bpmnDir).filter((entry) => entry.endsWith('.bpmn'))) {
      diagrams[name.replace(/\.bpmn$/, '')] = readFileSync(join(bpmnDir, name), 'utf8');
    }
  }
  const elementIds = new Map<string, Set<string>>();
  const moddle = new BpmnModdle();
  for (const [name, xml] of Object.entries(diagrams)) {
    const file = `content/bpmn/${name}.bpmn`;
    try {
      const { warnings, elementsById } = await moddle.fromXML(xml);
      for (const warning of warnings) errors.push(`${file}: ${warning.message}`);
      elementIds.set(name, new Set(Object.keys(elementsById)));
      if (!/<bpmndi:BPMNDiagram/.test(xml)) errors.push(`${file}: has no diagram layout`);
    } catch (error) {
      errors.push(`${file}: not valid BPMN: ${(error as Error).message}`);
    }
  }

  let feelKeysChecked = 0;
  let dmnKeysChecked = 0;
  const usedDiagrams = new Set<string>();

  for (const { file, item: question } of questions) {
    const where = `${file}: ${question.id}`;
    const track = trackOf.get(question.track);
    if (!track) {
      errors.push(`${where}: unknown track "${question.track}"`);
    } else {
      if (!track.domains.some((domain) => domain.id === question.domain)) {
        errors.push(`${where}: "${question.domain}" is not a domain of ${track.id}`);
      }
      if (question.source.version !== track.camundaVersion) {
        errors.push(
          `${where}: written against Camunda ${question.source.version}, but the exam covers ${track.camundaVersion}`,
        );
      }
      if (!question.source.url.includes(`/docs/${track.camundaVersion}/`)) {
        errors.push(`${where}: source must link to the ${track.camundaVersion} docs`);
      }
    }
    if (question.scenario && scenarioOf.get(question.scenario)?.track !== question.track) {
      errors.push(`${where}: no ${question.track} scenario called "${question.scenario}"`);
    }
    if (question.diagram) {
      const { file: diagram, highlight } = question.diagram;
      usedDiagrams.add(diagram);
      const ids = elementIds.get(diagram);
      if (!diagrams[diagram]) errors.push(`${where}: no diagram called "${diagram}"`);
      for (const id of highlight) {
        if (ids && !ids.has(id)) errors.push(`${where}: "${diagram}" has no element "${id}"`);
      }
    }
    const firstCorrect = question.options[question.correctIndexes[0]!]!;
    if (question.feel) {
      feelKeysChecked++;
      try {
        const actual = evaluateFeel(question.feel.expression, question.feel.context);
        if (actual !== firstCorrect) {
          errors.push(`${where}: FEEL returns ${actual}, but the key says ${firstCorrect}`);
        }
        const others = question.options.filter((option) => option !== firstCorrect);
        if (others.includes(actual)) errors.push(`${where}: another option is also ${actual}`);
      } catch (error) {
        errors.push(`${where}: FEEL failed: ${(error as Error).message}`);
      }
    }
    if (question.dmn) {
      dmnKeysChecked++;
      try {
        const actual = evaluateDmn(question.dmn);
        const expected = question.dmn.expectedResult ?? firstCorrect;
        if (actual !== expected) {
          errors.push(`${where}: the table gives ${actual}, but the key says ${expected}`);
        }
      } catch (error) {
        errors.push(`${where}: DMN failed: ${(error as Error).message}`);
      }
    }
  }

  for (const name of Object.keys(diagrams)) {
    if (!usedDiagrams.has(name)) errors.push(`content/bpmn/${name}.bpmn: no question uses it`);
  }

  const items = questions.map(({ item }) => item);
  for (const track of tracks) {
    const pool = items.filter((question) => allowedInMock(question, track));
    if (pool.length === 0) errors.push(`${track.id}: has no questions a mock can use`);
    for (const { domain, count, expected } of unbalancedDomains(track.domains, pool)) {
      errors.push(
        `${track.id}: unbalanced bank: "${domain}" has ${count} mock questions, but its weighting asks for about ${expected.toFixed(1)}`,
      );
    }
    for (const domain of track.domains) {
      const covered = notes.some(
        ({ item }) => item.track === track.id && item.domain === domain.id,
      );
      if (!covered) errors.push(`${track.id}: no study notes for "${domain.id}"`);
    }
  }

  for (const { file, item: note } of notes) {
    const track = trackOf.get(note.track);
    if (!track?.domains.some((domain) => domain.id === note.domain)) {
      errors.push(`${file}: notes for "${note.domain}", which is not a domain of ${note.track}`);
    }
  }

  for (const { file, item: exam } of exams) {
    const track = trackOf.get(exam.track);
    if (!track) {
      errors.push(`${file}: unknown track "${exam.track}"`);
      continue;
    }
    if (new Set(exam.questions).size !== exam.questions.length) {
      errors.push(`${file}: lists a question twice`);
    }
    const listed = exam.questions.flatMap((id) => {
      const question = questionOf.get(id);
      if (!question) errors.push(`${file}: lists unknown question "${id}"`);
      return question ? [question] : [];
    });
    for (const question of listed) {
      if (!allowedInMock(question, track)) {
        errors.push(`${file}: "${question.id}" is not allowed in a ${track.id} mock`);
      }
    }
    for (const { domain, count, expected } of unbalancedDomains(track.domains, listed)) {
      errors.push(
        `${file}: unbalanced exam: "${domain}" has ${count} questions, but its weighting asks for about ${expected.toFixed(1)}`,
      );
    }
  }

  return {
    errors,
    bank: {
      tracks,
      questions: items,
      scenarios: scenarios.map(({ item }) => item),
      exams: exams.map(({ item }) => item),
      notes: notes.map(({ item }) => item),
      diagrams,
    },
    counts: {
      questions: items.length,
      reviewed: items.filter((question) => question.reviewed).length,
      feelKeysChecked,
      dmnKeysChecked,
      diagrams: Object.keys(diagrams).length,
    },
  };
}
