export const QUESTION_COUNTS = [10, 20, 30] as const;

export function QuestionCountPicker({ value, onChange }: { value: number; onChange: (count: number) => void }) {
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
      </div>
      <p className="hint">범위에 단어가 그보다 적으면 있는 만큼만 나와요.</p>
    </fieldset>
  );
}
