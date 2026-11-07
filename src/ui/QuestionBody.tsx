import type { ReactNode } from 'react';
import { findScenario } from '../content/bank.ts';
import type { DmnTable, Question } from '../content/schema.ts';
import { BpmnDiagram } from './BpmnDiagram.tsx';
import { Markdown } from './Markdown.tsx';

function DmnView({ table }: { table: DmnTable }) {
  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-semibold">
        {table.name}{' '}
        <span className="font-normal text-slate-600">(hit policy: {table.hitPolicy})</span>
      </figcaption>
      {/* A wide table scrolls within its own box on a narrow screen. */}
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1 font-medium">Rule</th>
              {table.inputs.map((input) => (
                <th
                  key={input.expression}
                  className="border border-slate-300 px-2 py-1 font-medium"
                >
                  {input.label}
                  <span className="block font-mono text-xs font-normal text-slate-600">
                    {input.expression}
                  </span>
                </th>
              ))}
              <th className="border border-slate-300 px-2 py-1 font-medium">
                {table.output.label}
                <span className="block font-mono text-xs font-normal text-slate-600">
                  {table.output.name}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rules.map((rule, index) => (
              <tr key={index}>
                <td className="border border-slate-300 px-2 py-1 tabular-nums">{index + 1}</td>
                {rule.when.map((cell, column) => (
                  <td key={column} className="border border-slate-300 px-2 py-1 font-mono text-xs">
                    {cell}
                  </td>
                ))}
                <td className="border border-slate-300 px-2 py-1 font-mono text-xs">{rule.then}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Given values={table.given} />
    </figure>
  );
}

function Given({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <dt className="font-medium">Given:</dt>
      {entries.map(([name, value]) => (
        <dd key={name} className="font-mono text-xs">
          {name} = {JSON.stringify(value)}
        </dd>
      ))}
    </dl>
  );
}

function FeelView({ feel }: { feel: NonNullable<Question['feel']> }) {
  return (
    <div className="mt-4">
      <pre className="overflow-x-auto rounded bg-slate-100 p-3 font-mono text-sm whitespace-pre-wrap">
        {feel.expression}
      </pre>
      <Given values={feel.context} />
    </div>
  );
}

// The question's text, and whichever table, diagram, or expression goes with it.
export function QuestionBody({ question }: { question: Question }) {
  return (
    <>
      <Markdown>{question.stem}</Markdown>
      {question.diagram && <BpmnDiagram diagram={question.diagram} />}
      {question.dmn && <DmnView table={question.dmn} />}
      {question.feel && <FeelView feel={question.feel} />}
    </>
  );
}

// Keeps a case study's text beside its question, or above it where there is no room.
export function WithScenario({ question, children }: { question: Question; children: ReactNode }) {
  const scenario = findScenario(question.scenario);
  if (!scenario) return <>{children}</>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <aside
        aria-label="Case study"
        className="ui-card max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 lg:sticky lg:top-4 lg:max-h-[80vh] lg:self-start"
      >
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Case study</p>
        <h2 className="mt-1 font-semibold">{scenario.title}</h2>
        <div className="mt-2">
          <Markdown>{scenario.body}</Markdown>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
