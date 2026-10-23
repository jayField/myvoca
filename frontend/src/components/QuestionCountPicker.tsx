import { useEffect, useState } from 'react';

export const QUESTION_COUNTS = [10, 20, 30] as const;
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 100;

export function clampQuestionCount(n: number): number {
  return Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.round(n)));
}

export function QuestionCountPicker({ value, onChange }: { value: number; onChange: (count: number) => void }) {
  // The text box keeps its own draft so it can be cleared and retyped without snapping back.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <fieldset className="field">
      <legend>문제 수</legend>
      <div className="choice-row">
        {QUESTION_COUNTS.map((n) => (
          <label key={n} className="chip">
            <input type="radio" name="question-count" checked={value === n} onChange={() => onChange(n)} />
            <span>{n}문제</span>
          </label>
        ))}
        <label className="number-input">
          <span className="sr-only">문제 수 직접 입력</span>
          <input
            type="number"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) onChange(clampQuestionCount(n));
            }}
            onBlur={() => setDraft(String(value))}
          />
          <span aria-hidden="true">문제</span>
        </label>
      </div>
      <p className="hint">
        {MIN_QUESTIONS}~{MAX_QUESTIONS}문제까지 직접 입력할 수 있어요. 범위에 단어가 그보다 적으면 있는 만큼만 나와요.
      </p>
    </fieldset>
  );
}
