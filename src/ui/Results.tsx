import { useEffect, useMemo, useState } from 'react';
import { examSummary, formatDuration, type Attempt } from '../attempt/attempt.ts';
import { historyEntry, recordInHistory } from '../attempt/history.ts';
import { displayPercent, scoreAttempt, type QuestionScore } from '../attempt/score.ts';
import { domainLabel, examQuestions, trackById } from '../content/bank.ts';
import { optionOrder } from '../content/option-order.ts';
import type { Exam } from '../content/schema.ts';
import { recordAttempt } from '../practice/missed.ts';
import { PercentBars, TargetMeter } from './charts.tsx';
import { IntegritySummary } from './IntegritySummary.tsx';
import { Markdown } from './Markdown.tsx';
import { QuestionBody, WithScenario } from './QuestionBody.tsx';

export function Explanation({ text, source }: { text: string; source: { url: string } }) {
  return (
    <div className="mt-3 rounded bg-slate-50 p-3">
      <p className="text-sm font-semibold">Explanation</p>
      <Markdown>{text}</Markdown>
      <a
        className="mt-1 inline-block text-sm underline"
        href={source.url}
        target="_blank"
        rel="noreferrer"
      >
        Read more in the Camunda docs
      </a>
    </div>
  );
}

function QuestionReview({ score, attempt }: { score: QuestionScore; attempt: Attempt }) {
  const { question } = score;
  const selected = attempt.answers[question.id]?.selected ?? [];
  return (
    <div className="mt-3">
      <WithScenario question={question}>
        <QuestionBody question={question} />
        <ul className="mt-3 space-y-1">
          {optionOrder(question.options, `${attempt.id}/${question.id}`).map((index) => {
            const option = question.options[index]!;
            const correct = question.correctIndexes.includes(index);
            const chosen = selected.includes(index);
            return (
              <li
                key={option}
                className={`flex justify-between gap-3 rounded border p-2 text-sm ${
                  correct ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
                }`}
              >
                <span className={question.feel ? 'font-mono' : ''}>{option}</span>
                <span className="shrink-0 text-xs font-medium text-slate-700">
                  {[correct && '✓ Correct answer', chosen && 'Your answer']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            );
          })}
        </ul>
        {selected.length === 0 && (
          <p className="mt-2 text-sm text-slate-600">You did not answer.</p>
        )}
        <Explanation text={question.explanation} source={question.source} />
      </WithScenario>
    </div>
  );
}

// Each review opens on demand, as a diagram cannot be drawn while it is hidden.
function ReviewItem({
  item,
  number,
  title,
  attempt,
}: {
  item: QuestionScore;
  number: number;
  title: string;
  attempt: Attempt;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded border border-slate-200">
      <details className="p-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 text-sm">
          <span className="font-medium">
            {number}. {title}
          </span>
          <span className="ml-auto text-xs text-slate-600">{formatDuration(item.timeMs)}</span>
          <span className="w-24 text-right font-semibold">
            {item.earned === 1 ? '✓ Correct' : '✗ Incorrect'}
          </span>
        </summary>
        {open && <QuestionReview score={item} attempt={attempt} />}
      </details>
    </li>
  );
}

interface ResultsProps {
  attempt: Attempt;
  exam: Exam;
  // Whether this is the attempt just finished, which needs recording. A past one is read-only.
  record?: boolean;
  onClose: () => void;
  closeLabel: string;
  onShowProgress?: () => void;
}

export function Results({
  attempt,
  exam,
  record = false,
  onClose,
  closeLabel,
  onShowProgress,
}: ResultsProps) {
  const track = trackById(exam.track);
  const questions = useMemo(() => examQuestions(exam), [exam]);
  const score = useMemo(() => scoreAttempt(attempt, exam), [attempt, exam]);

  useEffect(() => {
    if (!record) return;
    recordInHistory(historyEntry(attempt, exam.name, score));
    recordAttempt(
      attempt.id,
      score.questions.map(({ question, earned }) => ({
        id: question.id,
        correct: earned === 1,
      })),
      Date.now(),
    );
  }, [record, attempt, exam.name, score]);

  const summary = examSummary(attempt, questions);
  const percent = displayPercent(score.percent);
  const gap = track.readinessTarget - percent;
  const buttonClass =
    'ui-btn rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50';
  const totalTime = score.questions.reduce((sum, item) => sum + item.timeMs, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-sans text-slate-900 sm:px-8">
      <p className="font-semibold text-emerald-700">{exam.name}</p>
      <h1 className="mt-1 text-3xl font-bold">
        {attempt.status === 'expired' ? 'Time is up' : 'Test submitted'}
      </h1>
      <p className="mt-2 text-slate-700">
        You answered {summary.answered} of {summary.total} questions, in {formatDuration(totalTime)}
        .
      </p>

      <section className="ui-card mt-6 rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-600">Total score</h2>
        <p className="text-5xl font-bold tabular-nums">{percent}%</p>
        <p className="mt-1 font-semibold">
          {score.passed
            ? `✓ Above the real exam's ${track.passMark}% pass mark.`
            : `✗ Below the real exam's ${track.passMark}% pass mark.`}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {gap <= 0
            ? `✓ At or above your ${track.readinessTarget}% readiness target.`
            : `${gap} ${gap === 1 ? 'point' : 'points'} below your ${track.readinessTarget}% readiness target.`}
        </p>
        <div className="mt-6">
          <TargetMeter percent={score.percent} target={track.readinessTarget} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">By domain, weakest first</h2>
        <div className="mt-2">
          <PercentBars
            label="Score by domain"
            rows={score.domains.map((domain) => ({
              label: domainLabel(track, domain.domain),
              percent: domain.percent,
              detail: `${domain.questions} ${domain.questions === 1 ? 'question' : 'questions'}`,
            }))}
          />
        </div>
      </section>

      <IntegritySummary attempt={attempt} />

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Review each question</h2>
        <ol className="mt-2 space-y-2">
          {score.questions.map((item, index) => (
            <ReviewItem
              key={item.question.id}
              item={item}
              number={index + 1}
              title={domainLabel(track, item.question.domain)}
              attempt={attempt}
            />
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={onClose}>
          {closeLabel}
        </button>
        {onShowProgress && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              onClose();
              onShowProgress();
            }}
          >
            View progress
          </button>
        )}
      </div>
    </main>
  );
}
