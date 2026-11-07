import { lazy, Suspense } from 'react';
import { diagramXml } from '../content/bank.ts';
import type { Question } from '../content/schema.ts';

// bpmn-js is large, so it loads when a question first shows a diagram.
const BpmnCanvas = lazy(() => import('./BpmnCanvas.tsx'));

export function BpmnDiagram({ diagram }: { diagram: NonNullable<Question['diagram']> }) {
  const xml = diagramXml(diagram.file);
  return (
    <figure className="mt-4">
      {xml && (
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center rounded border border-slate-200 text-sm text-slate-600">
              Loading the diagram…
            </div>
          }
        >
          <BpmnCanvas xml={xml} highlight={diagram.highlight} label={diagram.description} />
        </Suspense>
      )}
      <figcaption className="mt-1">
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer">Describe this diagram</summary>
          <p className="mt-1">{diagram.description}</p>
        </details>
      </figcaption>
    </figure>
  );
}
