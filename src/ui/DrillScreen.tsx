import { useState } from 'react';
import { loadHistory } from '../attempt/history.ts';
import {
  domainLabel,
  findQuestion,
  questionsFor,
  scenariosFor,
  trackById,
} from '../content/bank.ts';
import { optionOrder } from '../content/option-order.ts';
import type { TrackId } from '../content/schema.ts';
import {
  checkAnswer,
  chooseOption,
  drillSummary,
  isCorrect,
  loadDrill,
  nextQuestion,
  retryQuestions,
  saveDrill,
  scenarioDrill,
  startDrill,
  weakestDomains,
  type Drill,
} from '../practice/drill.ts';
import { loadMissed, missedIds, recordQuestionResult } from '../practice/missed.ts';
import { QuestionBody, WithScenario } from './QuestionBody.tsx';
import { Explanation } from './Results.tsx';

const WEAK_DOMAIN_COUNT = 3;

function DrillSetup({ track, onStart }: { track: TrackId; onStart: (drill: Drill) => void }) {
  const details = trackById(track);
  const bank = questionsFor(track);
  const [domains, setDomains] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [weak] = useState(() =>
    weakestDomains(
      loadHistory().filter((entry) => entry.track === track),
      WEAK_DOMAIN_COUNT,
    ),
  );
  const [missed] = useState(() =>
    missedIds(loadMissed().questions, new Set(bank.map((question) => question.id))),
  );
  const available = details.domains.filter((domain) =>
    bank.some((question) => question.domain === domain.id),
  );
  const scenarios = scenariosFor(track);

  return (
    <section className="mt-4">
      <p className="text-slate-700">
        Untimed practice, with the answer and explanation after each question. Drills include
        question types the real exam may not use, and do not affect your mock exam scores.
      </p>
      {missed.length > 0 && (
        <button
          type="button"
          className="ui-btn ui-btn-primary mt-4 rounded bg-emerald-700 px-4 py-2 font-semibold text-white"
          onClick={() => onStart(retryQuestions(track, missed.slice(0, count)))}
        >
          Retry {Math.min(count, missed.length)} of the {missed.length}{' '}
          {missed.length === 1 ? 'question' : 'questions'} you got wrong
        </button>
      )}
      {scenarios.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">Case studies</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className="ui-btn rounded border border-slate-300 px-3 py-2 text-left text-sm font-medium"
                onClick={() => onStart(scenarioDrill(track, scenario.id))}
              >
                {scenario.title}
              </button>
            ))}
          </div>
        </section>
      )}
      <fieldset className="mt-6">
        <legend className="font-semibold">Domains</legend>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="ui-btn rounded border border-slate-300 px-2 py-1"
            onClick={() => setDomains(available.map((domain) => domain.id))}
          >
            Select all
          </button>
          {weak.length > 0 && (
            <button
              type="button"
              className="ui-btn rounded border border-slate-300 px-2 py-1"
              onClick={() => setDomains(weak)}
            >
              My weakest domains
            </button>
          )}
          <button
            type="button"
            className="ui-btn rounded border border-slate-300 px-2 py-1"
            onClick={() => setDomains([])}
          >
            Clear
          </button>
        </div>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {available.map((domain) => (
            <label key={domain.id} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={domains.includes(domain.id)}
                onChange={(event) =>
                  setDomains(
                    event.target.checked
                      ? [...domains, domain.id]
                      : domains.filter((other) => other !== domain.id),
                  )
                }
              />
              {domain.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block text-sm font-medium">
        Number of questions{' '}
        <select
          className="ml-1 rounded border border-slate-300 p-1"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        >
          {[5, 10, 20, 50].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={domains.length === 0}
        className="ui-btn ui-btn-primary mt-4 rounded bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
        onClick={() => onStart(startDrill(track, domains, count))}
      >
        Start drill
      </button>
    </section>
  );
}

function DrillQuestion({ drill, onChange }: { drill: Drill; onChange: (drill: Drill) => void }) {
  const id = drill.questionIds[drill.index]!;
  const question = findQuestion(id)!;
  const answer = drill.answers[id] ?? { selected: [], checked: false };
  const correct = answer.checked && isCorrect(drill, question);

  return (
    <section className="mt-4">
      <p className="text-sm text-slate-600">
        Question {drill.index + 1} of {drill.questionIds.length},{' '}
        {domainLabel(trackById(drill.track), question.domain)}
      </p>
      <div className="mt-2">
        <WithScenario question={question}>
          <div className="ui-card rounded-lg border border-slate-200 p-4 sm:p-5">
            <QuestionBody key={question.id} question={question} />
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-600">
                {question.multiSelect ? 'Select all that apply' : 'Select one answer'}
              </legend>
              <div className="mt-2 space-y-2">
                {optionOrder(question.options, `${drill.seed}/${question.id}`).map((index) => {
                  const isRight = question.correctIndexes.includes(index);
                  return (
                    <label
                      key={index}
                      className={`flex items-center gap-3 rounded border p-3 ${
                        answer.checked && isRight
                          ? 'border-emerald-600 bg-emerald-50'
                          : answer.selected.includes(index)
                            ? 'border-slate-500'
                            : 'border-slate-200'
                      }`}
                    >
                      <input
                        type={question.multiSelect ? 'checkbox' : 'radio'}
                        name={question.id}
                        checked={answer.selected.includes(index)}
                        disabled={answer.checked}
                        onChange={() => onChange(chooseOption(drill, question, index))}
                      />
                      <span className={`text-sm ${question.feel ? 'font-mono' : ''}`}>
                        {question.options[index]}
                      </span>
                      {answer.checked && isRight && (
                        <span className="ml-auto text-xs font-medium">✓ Correct answer</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {answer.checked && (
              <div role="status" className="mt-4">
                <p className="font-semibold">{correct ? '✓ Correct' : '✗ Not quite'}</p>
                <Explanation text={question.explanation} source={question.source} />
              </div>
            )}
          </div>
        </WithScenario>
      </div>
      <div className="mt-4">
        {answer.checked ? (
          <button
            type="button"
            className="ui-btn ui-btn-primary rounded bg-emerald-700 px-5 py-2 font-semibold text-white"
            onClick={() => onChange(nextQuestion(drill))}
          >
            {drill.index === drill.questionIds.length - 1 ? 'See results' : 'Next question'}
          </button>
        ) : (
          <button
            type="button"
            disabled={answer.selected.length === 0}
            className="ui-btn ui-btn-primary rounded bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
            onClick={() => {
              const checked = checkAnswer(drill, id);
              recordQuestionResult(id, isCorrect(checked, question), Date.now());
              onChange(checked);
            }}
          >
            Check answer
          </button>
        )}
      </div>
    </section>
  );
}

function DrillResults({
  drill,
  onChange,
}: {
  drill: Drill;
  onChange: (drill: Drill | null) => void;
}) {
  const { total, correct, missedIds: missed } = drillSummary(drill);
  return (
    <section className="mt-4">
      <h2 className="text-xl font-semibold">
        You got {correct} of {total} right
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {missed.length > 0 && (
          <button
            type="button"
            className="ui-btn ui-btn-primary rounded bg-emerald-700 px-4 py-2 font-semibold text-white"
            onClick={() => onChange(retryQuestions(drill.track, missed))}
          >
            Retry the {missed.length} you missed
          </button>
        )}
        <button
          type="button"
          className="ui-btn rounded border border-slate-300 px-4 py-2 font-medium"
          onClick={() => onChange(null)}
        >
          New drill
        </button>
      </div>
    </section>
  );
}

export function DrillScreen({ track }: { track: TrackId }) {
  const [drill, setDrill] = useState<Drill | null>(() => loadDrill(track));
  const change = (next: Drill | null) => {
    saveDrill(track, next);
    setDrill(next);
  };
  const current = drill?.questionIds.length === 0 ? null : drill;

  return (
    <main
      className={`mx-auto px-4 py-8 font-sans text-slate-900 sm:px-8 ${
        findQuestion(current?.questionIds[current.index])?.scenario && !current?.finished
          ? 'max-w-6xl'
          : 'max-w-3xl'
      }`}
    >
      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Practice drill</h1>
        {current && !current.finished && (
          <button type="button" className="text-sm underline" onClick={() => change(null)}>
            End drill
          </button>
        )}
      </div>
      {!current ? (
        <DrillSetup track={track} onStart={change} />
      ) : current.finished ? (
        <DrillResults drill={current} onChange={change} />
      ) : (
        <DrillQuestion drill={current} onChange={change} />
      )}
    </main>
  );
}
