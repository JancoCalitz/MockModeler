import { useEffect, useMemo } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import { clearSelection, selectOption, type Attempt } from '../attempt/attempt.ts';
import { optionOrder } from '../content/option-order.ts';
import type { Question } from '../content/schema.ts';
import { isShortcut } from './keys.ts';
import { QuestionBody, WithScenario } from './QuestionBody.tsx';

// Every question has four options.
const LETTERS = 'ABCD';

interface McqViewProps {
  attempt: Attempt;
  question: Question;
  update: UpdateAttempt;
}

export function McqView({ attempt, question, update }: McqViewProps) {
  const selected = attempt.answers[question.id]?.selected ?? [];
  const order = useMemo(
    () => optionOrder(question.options, `${attempt.id}/${question.id}`),
    [question.options, attempt.id, question.id],
  );

  // 1 to 4, or A to D, picks the option shown in that place.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      const key = event.key.toUpperCase();
      const place = /^[1-4]$/.test(key)
        ? Number(key) - 1
        : key.length === 1
          ? LETTERS.indexOf(key)
          : -1;
      const index = order[place];
      if (index === undefined) return;
      event.preventDefault();
      update((current) => selectOption(current, question.id, index, question.multiSelect));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, question, update]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-3 sm:p-6">
      <div className={`mx-auto ${question.scenario ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <WithScenario question={question}>
          <div className="ui-card rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            <QuestionBody question={question} />
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-slate-600">
                {question.multiSelect ? 'Select all that apply' : 'Select one answer'}
              </legend>
              <div className="mt-2 space-y-2">
                {order.map((index, place) => (
                  <label
                    key={index}
                    className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${
                      selected.includes(index)
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type={question.multiSelect ? 'checkbox' : 'radio'}
                      name={question.id}
                      checked={selected.includes(index)}
                      onChange={() =>
                        update((current) =>
                          selectOption(current, question.id, index, question.multiSelect),
                        )
                      }
                    />
                    <kbd
                      aria-hidden="true"
                      className="rounded border border-slate-300 px-1.5 font-mono text-xs text-slate-500"
                    >
                      {LETTERS[place]}
                    </kbd>
                    <span className={`text-sm ${question.feel ? 'font-mono' : ''}`}>
                      {question.options[index]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="mt-4 text-sm text-slate-600 underline disabled:no-underline disabled:opacity-40"
              disabled={selected.length === 0}
              onClick={() => update((current) => clearSelection(current, question.id))}
            >
              Clear selection
            </button>
          </div>
        </WithScenario>
      </div>
    </div>
  );
}
