import { useMemo } from 'react';
import { loadHistory } from '../attempt/history.ts';
import { combineDomains, displayPercent } from '../attempt/score.ts';
import { notesFor, questionsFor, trackById } from '../content/bank.ts';
import type { TrackId } from '../content/schema.ts';
import { startDrill, type Drill } from '../practice/drill.ts';
import { Markdown } from './Markdown.tsx';

const DRILL_QUESTIONS = 10;

interface StudyScreenProps {
  track: TrackId;
  onDrill: (drill: Drill) => void;
}

// Short notes for each blueprint domain, heaviest first, so time goes where the exam's marks are.
export function StudyScreen({ track: trackId, onDrill }: StudyScreenProps) {
  const track = trackById(trackId);
  const notes = notesFor(trackId);
  const bank = questionsFor(trackId);
  const scores = useMemo(() => {
    const entries = loadHistory().filter((entry) => entry.track === trackId);
    return new Map(
      combineDomains(entries.slice(-5).map((entry) => entry.domains)).map((score) => [
        score.domain,
        score.percent,
      ]),
    );
  }, [trackId]);
  const domains = [...track.domains].sort((a, b) => b.weight - a.weight);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-sans text-slate-900 sm:px-8">
      <h1 className="text-3xl font-bold">Study notes</h1>
      <p className="mt-2 text-slate-700">
        {track.name}, written for Camunda {track.camundaVersion}. These are summaries to steer your
        reading: the linked docs are the authority. Domains are listed by their share of the exam.
      </p>
      <nav aria-label="Domains" className="mt-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          {domains.map((domain) => (
            <li key={domain.id}>
              <a
                className="inline-block rounded border border-slate-300 px-2 py-1.5"
                href={`#domain-${domain.id}`}
              >
                {domain.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {domains.map((domain) => {
        const note = notes.find((candidate) => candidate.domain === domain.id);
        if (!note) return null;
        const score = scores.get(domain.id);
        const available = bank.filter((question) => question.domain === domain.id).length;
        return (
          <section
            key={domain.id}
            id={`domain-${domain.id}`}
            className="ui-card mt-6 scroll-mt-4 rounded-lg border border-slate-200 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-xl font-semibold">{domain.label}</h2>
              <p className="text-sm text-slate-600">
                {domain.weight}% of the exam
                {score !== undefined && `, your recent score ${displayPercent(score)}%`}
              </p>
            </div>
            <div className="mt-2">
              <Markdown>{note.summary}</Markdown>
            </div>
            <h3 className="mt-3 text-sm font-semibold">Key points</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {note.keyPoints.map((point) => (
                <li key={point}>
                  <Markdown>{point}</Markdown>
                </li>
              ))}
            </ul>
            <h3 className="mt-3 text-sm font-semibold">Read in the docs</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {note.links.map((link) => (
                <li key={link.url}>
                  <a
                    className="inline-block py-2 underline sm:py-0.5"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
            {available > 0 && (
              <button
                type="button"
                className="ui-btn mt-4 rounded border border-slate-300 px-3 py-2 text-sm font-medium"
                onClick={() => onDrill(startDrill(trackId, [domain.id], DRILL_QUESTIONS))}
              >
                Drill {domain.label} ({Math.min(available, DRILL_QUESTIONS)} questions)
              </button>
            )}
          </section>
        );
      })}
    </main>
  );
}
