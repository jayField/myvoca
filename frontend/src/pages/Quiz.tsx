import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, CONFUSING_DECK_ID, LOAD_ERROR, type Deck, type Grade, type Item, type Quiz as QuizData } from '../api';
import { BackIcon, SpeakerIcon } from '../components/Icons';
import { PracticeCards } from '../components/PracticeCards';
import { QuestionCountPicker } from '../components/QuestionCountPicker';
import { showsReading, Term } from '../components/Term';
import { GRADES } from '../labels';
import { speak } from '../speech';

type Mode = 'meaning' | 'listen' | 'type';

const MODES: { mode: Mode; label: string; description: string }[] = [
  { mode: 'meaning', label: '뜻 고르기', description: '단어를 보고 뜻을 골라요' },
  { mode: 'listen', label: '듣기', description: '발음을 듣고 단어를 골라요' },
  { mode: 'type', label: '직접 입력', description: '읽는 법을 직접 써요' },
];

const ROMAJI_ALIASES: Record<string, string[]> = {
  shi: ['si'],
  chi: ['ti'],
  tsu: ['tu'],
  fu: ['hu'],
  wo: ['o'],
  n: ['nn'],
  ji: ['zi', 'di'],
  zu: ['du'],
  sha: ['sya'],
  shu: ['syu'],
  sho: ['syo'],
  cha: ['tya', 'cya'],
  chu: ['tyu', 'cyu'],
  cho: ['tyo', 'cyo'],
  ja: ['zya', 'jya'],
  ju: ['zyu', 'jyu'],
  jo: ['zyo', 'jyo'],
};

interface Answer {
  item: Item;
  correct: boolean;
  grade: Grade;
}

function normalize(text: string): string {
  // Katakana → hiragana so either script is accepted for word readings.
  return text
    .trim()
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function isCorrectReading(item: Item, input: string): boolean {
  const answer = normalize(input);
  const reading = normalize(item.reading);
  return answer === reading || (item.kind === 'kana' && (ROMAJI_ALIASES[reading] ?? []).includes(answer));
}

export default function Quiz() {
  const [params] = useSearchParams();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState(params.get('deck') ?? '');
  const [count, setCount] = useState(10);
  // No mode in the address means the quiz menu; picking a card adds ?mode=.
  const modeInfo = MODES.find((m) => m.mode === params.get('mode')) ?? null;
  const mode = modeInfo?.mode ?? null;
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.decks(), api.settings()])
      .then(([d, s]) => {
        setDecks(d.decks);
        setDeckId((current) => current || s.deck_id);
      })
      .catch(() => setError(LOAD_ERROR));
  }, []);

  const question = quiz?.questions[index];
  const answered = answers.length > index;
  const finished = quiz !== null && quiz.questions.length > 0 && index >= quiz.questions.length;

  useEffect(() => {
    if (mode === 'listen' && question && !answered) speak(question.item.term);
  }, [mode, question, answered]);

  // Switching mode (or going back to the menu) ends any quiz in progress.
  useEffect(() => {
    setQuiz(null);
  }, [mode]);

  async function start() {
    try {
      setQuiz(await api.quiz(deckId, count));
      setIndex(0);
      setAnswers([]);
      setPicked(null);
      setTyped('');
      setSaved(false);
      setError(null);
    } catch {
      setError(LOAD_ERROR);
    }
  }

  function record(correct: boolean) {
    if (!question || answered) return;
    setAnswers((a) => [...a, { item: question.item, correct, grade: correct ? 'good' : 'again' }]);
  }

  function next() {
    setIndex((i) => i + 1);
    setPicked(null);
    setTyped('');
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (answered) next();
    else if (question && typed.trim()) record(isCorrectReading(question.item, typed));
  }

  async function saveGrades() {
    setSaving(true);
    try {
      for (const a of answers) await api.review(a.item.id, a.grade, 'quiz');
      setSaved(true);
    } catch {
      setError('기록하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (!mode) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1>퀴즈</h1>
            <p className="muted small">방식을 고르면 범위와 문제 수를 정하고 시작해요.</p>
          </div>
        </header>
        <PracticeCards deckId={params.get('deck')} />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div>
            <Link to="/quiz" className="back-link">
              <BackIcon />
              퀴즈
            </Link>
            <h1>{modeInfo!.label}</h1>
            <p className="muted small">{modeInfo!.description}</p>
          </div>
        </header>
        {error && <p className="banner-error">{error}</p>}
        <div className="card card--lg stack">
          <fieldset className="field">
            <legend>범위</legend>
            <div className="choice-row">
              {[...decks.map((d) => ({ id: d.id, title: d.title })), { id: CONFUSING_DECK_ID, title: '헷갈리는 단어' }].map((d) => (
                <label key={d.id} className="chip">
                  <input type="radio" name="deck" checked={deckId === d.id} onChange={() => setDeckId(d.id)} />
                  <span>{d.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <QuestionCountPicker value={count} onChange={setCount} />
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void start()} disabled={!deckId}>
            {count}문제 시작
          </button>
        </div>
      </div>
    );
  }

  if (quiz.questions.length === 0) {
    return (
      <div className="page page--narrow">
        <div className="empty">
          <h1>낼 문제가 없어요</h1>
          <p className="muted">헷갈리는 단어가 아직 없어요. 다른 범위를 골라 보세요.</p>
          <button type="button" className="btn btn--primary" onClick={() => setQuiz(null)}>
            범위 다시 고르기
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const correct = answers.filter((a) => a.correct).length;
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div>
            <h1>
              {answers.length}문제 중 {correct}개 정답
            </h1>
            <p className="muted small">단어마다 얼마나 알았는지 골라 주세요. 복습 일정에 반영돼요.</p>
          </div>
        </header>
        {error && <p className="banner-error">{error}</p>}
        <ul className="item-list">
          {answers.map((a, i) => (
            <li key={`${a.item.id}-${i}`} className="item-row item-row--quiz">
              <Term item={a.item} className="item-term" />
              <span className="item-text">
                <span>{a.item.kind === 'kana' ? a.item.reading : a.item.meaning}</span>
                <span className={a.correct ? 'success-text small' : 'danger-text small'}>{a.correct ? '정답' : '오답'}</span>
              </span>
              <div className="segmented" role="radiogroup" aria-label={`${a.item.term} 평가`}>
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    role="radio"
                    aria-checked={a.grade === g.grade}
                    disabled={saved}
                    className={a.grade === g.grade ? `segment segment--on segment--${g.grade}` : 'segment'}
                    onClick={() => setAnswers((list) => list.map((x, j) => (j === i ? { ...x, grade: g.grade } : x)))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="button-row">
          {saved ? (
            <>
              <span className="success-text">복습 일정에 기록했어요.</span>
              <Link to="/" className="btn btn--primary">
                홈으로
              </Link>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--primary" onClick={() => void saveGrades()} disabled={saving}>
                {saving ? '기록 중…' : '기록하고 마치기'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setQuiz(null)}>
                기록 없이 마치기
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const q = question!;
  const lastAnswer = answers[index];
  const showTerm = mode !== 'listen';
  const choiceLabel = (c: Item) => (mode === 'listen' ? <Term item={c} /> : c.meaning);

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <button type="button" className="back-link back-link--btn" onClick={() => setQuiz(null)}>
          그만하기
        </button>
        <span className="muted small">
          {index + 1} / {quiz.questions.length}
        </span>
      </header>
      {quiz.source === 'mixed' && index === 0 && (
        <p className="muted small">학습한 단어가 문제 수보다 적어서, 같은 범위의 다른 단어로 채웠어요.</p>
      )}
      <div className="progress">
        <div className="progress-fill" style={{ width: `${(index / quiz.questions.length) * 100}%` }} />
      </div>

      <div className="card card--lg quiz-question">
        {showTerm ? (
          // Typing the reading tests the kanji, so that mode always shows the kanji form.
          mode === 'type' ? (
            <span lang="ja" className="quiz-term">
              {q.item.term}
            </span>
          ) : (
            <Term item={q.item} className="quiz-term" />
          )
        ) : (
          <button type="button" className="listen-btn" aria-label="다시 듣기" onClick={() => speak(q.item.term)}>
            <SpeakerIcon />
          </button>
        )}
        {answered && (
          <p className={lastAnswer.correct ? 'success-text' : 'danger-text'}>
            {lastAnswer.correct ? '정답이에요' : '아쉬워요'} ·{' '}
            <Term item={q.item} />
            {showsReading(q.item) && ` ${q.item.reading}`}
            {q.item.kind === 'word' && ` · ${q.item.meaning}`}
          </p>
        )}
      </div>

      {mode === 'type' ? (
        <form className="type-answer" onSubmit={submitTyped}>
          <label htmlFor="typed" className="muted small">
            {q.item.kind === 'kana' ? '로마자로 입력 (예: ka)' : '히라가나로 읽는 법 입력'}
          </label>
          <div className="type-row">
            <input
              id="typed"
              className="text-input"
              lang={q.item.kind === 'kana' ? undefined : 'ja'}
              autoComplete="off"
              autoCapitalize="off"
              autoFocus
              readOnly={answered}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button type="submit" className="btn btn--primary">
              {answered ? '다음' : '확인'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="choice-grid">
            {q.choices.map((c, i) => {
              const state = !answered ? '' : c.id === q.item.id ? ' choice--correct' : picked === i ? ' choice--wrong' : '';
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`choice${state}`}
                  lang={mode === 'listen' ? 'ja' : undefined}
                  disabled={answered}
                  onClick={() => {
                    setPicked(i);
                    record(c.id === q.item.id);
                  }}
                >
                  {choiceLabel(c)}
                </button>
              );
            })}
          </div>
          {answered && (
            <button type="button" className="btn btn--primary btn--lg" onClick={next} autoFocus>
              다음
            </button>
          )}
        </>
      )}
    </div>
  );
}
