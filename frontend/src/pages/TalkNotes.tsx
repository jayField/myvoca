import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Phrase, Translation } from '../api';
import { CloseIcon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { WordBreakdown } from '../components/WordBreakdown';
import { localDate } from '../lib/dates';
import { deletePhrase, listPhrases, phraseSound, savePhrase, TALK_DECK, translatePhrase } from '../lib/phrases';

const MAX_INPUT = 100;

interface Draft {
  input: string;
  result: Translation;
}

export default function TalkNotes() {
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'translate' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only today's saves are listed here; everything saved so far lives in 단어장 → 회화 노트.
  const todayDate = localDate();
  const today = phrases?.filter((p) => localDate(new Date(p.created_at)) === todayDate) ?? null;

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function translate(text: string) {
    setBusy('translate');
    setError(null);
    try {
      setDraft({ input: text, result: await translatePhrase(text) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (input.trim() && !busy) void translate(input.trim());
  }

  function edit(field: keyof Translation, value: string) {
    setDraft((d) => d && { ...d, result: { ...d.result, [field]: value } });
  }

  async function save() {
    if (!draft) return;
    const result = { ...draft.result, japanese: draft.result.japanese.trim(), reading: draft.result.reading.trim(), meaning: draft.result.meaning.trim() };
    if (!result.japanese || !result.reading || !result.meaning) return setError('일본어, 읽기, 뜻을 모두 채워 주세요.');
    setBusy('save');
    setError(null);
    try {
      const saved = await savePhrase(draft.input, result);
      setPhrases((list) => [saved, ...(list ?? [])]);
      setDraft(null);
      setInput('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Phrase) {
    if (!window.confirm(`'${p.japanese}'를 회화 노트에서 지울까요?`)) return;
    try {
      await deletePhrase(p.id);
      setPhrases((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>{TALK_DECK.title}</h1>
          <p className="muted small">{TALK_DECK.description}</p>
        </div>
        <div className="button-row">
          <Link to={`/quiz?deck=${TALK_DECK.id}`} className="btn btn--ghost">
            이 범위로 퀴즈
          </Link>
        </div>
      </header>

      <form className="card card--lg talk-card" onSubmit={submit}>
        <label className="form-field stack-sm">
          <span className="card-title">번역하기</span>
          <span className="hint">들은 일본어를 한글 발음 그대로 적어요. 한국어 문장이나 일본어로 적어도 돼요.</span>
          <input
            className="text-input text-input--block"
            maxLength={MAX_INPUT}
            placeholder="예) 고항 타베타이"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button type="submit" className="btn btn--primary" disabled={!input.trim() || busy !== null}>
            {busy === 'translate' ? '번역 중…' : '번역'}
          </button>
        </div>
      </form>

      {error && <p className="banner-error">{error}</p>}

      {draft && (
        <section className="card card--lg talk-card talk-draft" aria-labelledby="talk-draft">
          <div className="card-head">
            <h2 id="talk-draft" className="card-title">
              번역 결과
            </h2>
            <SpeakButton text={draft.result.japanese} />
          </div>
          <p className="muted small">입력: {draft.input}</p>
          <label className="talk-field">
            <span>일본어</span>
            <input lang="ja" className="text-input text-input--block talk-japanese" value={draft.result.japanese} onChange={(e) => edit('japanese', e.target.value)} />
          </label>
          <label className="talk-field">
            <span>읽기</span>
            <input lang="ja" className="text-input text-input--block" value={draft.result.reading} onChange={(e) => edit('reading', e.target.value)} />
          </label>
          <p className="muted small talk-sound">발음: {phraseSound(draft.result)}</p>
          <label className="talk-field">
            <span>뜻</span>
            <input className="text-input text-input--block" value={draft.result.meaning} onChange={(e) => edit('meaning', e.target.value)} />
          </label>
          {draft.result.words.length > 1 && (
            <div className="talk-block">
              <span className="talk-label">단어별로 보기</span>
              <WordBreakdown words={draft.result.words} />
            </div>
          )}
          {draft.result.note && <p className="hint">{draft.result.note}</p>}
          {draft.result.example_ja && (
            <div className="talk-example">
              <span className="talk-label">예시</span>
              <span lang="ja">{draft.result.example_ja}</span>
              <span className="muted">{draft.result.example_ko}</span>
            </div>
          )}
          <p className="hint">번역이 틀릴 수 있어요. 이상하면 고치거나 다시 번역해 보세요.</p>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy !== null}>
              {busy === 'save' ? '저장 중…' : '단어장에 저장'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void translate(draft.input)} disabled={busy !== null}>
              다시 번역
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)} disabled={busy !== null}>
              취소
            </button>
          </div>
        </section>
      )}

      {today && today.length === 0 && (
        <p className="muted small">
          오늘 저장한 표현이 아직 없어요. 지금까지 저장한 표현은 <Link to={`/decks/${TALK_DECK.id}`}>단어장 → 회화 노트</Link>에서 볼 수 있어요.
        </p>
      )}
      {today && today.length > 0 && (
        <section className="stack-sm" aria-labelledby="talk-saved">
          <div className="card-head">
            <h2 id="talk-saved" className="section-title day-title">
              오늘 저장한 표현 <span className="muted small">· {today.length}개</span>
            </h2>
            <Link to={`/decks/${TALK_DECK.id}`} className="muted small">
              전체 보기
            </Link>
          </div>
          <ul className="item-list">
            {today.map((p) => (
              <li key={p.id} className="item-row talk-row">
                <div className="talk-main">
                  <span lang="ja" className="talk-term">
                    {p.japanese}
                  </span>
                  <span className="item-text talk-text">
                    {p.reading !== p.japanese && <span lang="ja">{p.reading}</span>}
                    <span className="muted">{phraseSound(p)}</span>
                    <span>{p.meaning}</span>
                  </span>
                  <WordBreakdown words={p.words} />
                  {p.example_ja && (
                    <span className="talk-example small">
                      <span className="talk-label">예시</span>
                      <span lang="ja">{p.example_ja}</span>
                      <span className="muted">{p.example_ko}</span>
                    </span>
                  )}
                </div>
                <SpeakButton text={p.japanese} />
                <button
                  type="button"
                  className="icon-btn icon-btn--delete"
                  aria-label={`${p.japanese} 삭제`}
                  title="삭제"
                  onClick={() => void remove(p)}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
