import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Grade, Item } from '../api';
import { useAuth } from '../auth';
import { Flashcard } from '../components/Flashcard';
import { SpeakButton } from '../components/SpeakButton';
import { BackIcon } from '../components/Icons';
import { GRADES } from '../labels';
import { DAILY_DAYS, dailyLabel, dayTest, dayWords, loadPassedDays, markDayPassed, parseDay, testScore, testSeed } from '../lib/daily';
import { localDate } from '../lib/dates';
import { toHangul } from '../lib/kana';
import { seededRng, shuffle } from '../lib/random';

/**
 * A day's test, the same way as 오늘의 학습: flip the card, then 몰랐음 / 헷갈림 / 알았음. Only 알았음 on every
 * card is 100점, which passes the day; anything less offers the same words again, in a new order, until it is.
 * The earlier words lean on days not passed yet and are fixed for the calendar day, so they change daily.
 * Two halves: the twenty words read as Japanese (뜻 떠올리기), then the same words from their Korean meaning
 * (일본어 떠올리기), forty cards in all.
 * The grades stay in this test: nothing goes to 복습표, 헷갈리는 단어 or 오늘의 학습, so 하루 단어 is its own track.
 */
export default function DailyTest({ only = false }: { only?: boolean }) {
  const day = parseDay(useParams().day);
  if (day === null) return <Navigate to="/daily" replace />;
  // 오늘 단어만: just the day's ten words both ways, a practice run that never marks the day passed.
  if (only) return <Run key={`only-${day}`} day={day} cards={shuffle(dayWords(day)).map((item) => ({ item, earlier: false }))} userId={undefined} only />;
  return <Test key={day} day={day} />;
}

type Word = ReturnType<typeof dayTest>[number];
type Card = Word & { reverse: boolean };

/** The words Japanese → Korean, then the same words in a new order Korean → Japanese. */
function bothWays(words: Word[]): Card[] {
  return [...words.map((w) => ({ ...w, reverse: false })), ...shuffle(words).map((w) => ({ ...w, reverse: true }))];
}
const NO_COUNTS: Record<Grade, number> = { good: 0, hard: 0, again: 0 };

function Test({ day }: { day: number }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<Word[] | null>(null);

  useEffect(() => {
    let live = true;
    // Which days are owed decides the earlier words, so wait for the account's passed days first.
    void loadPassedDays(user?.id)
      .catch(() => new Set<number>())
      .then((passed) => live && setCards(dayTest(day, passed, seededRng(testSeed(localDate(), day)))));
    return () => {
      live = false;
    };
  }, [day, user?.id]);

  if (!cards) {
    return (
      <div className="page page--narrow">
        <p className="muted center">테스트 준비 중…</p>
      </div>
    );
  }
  return <Run day={day} cards={cards} userId={user?.id} />;
}

function Run({ day, cards, userId, only = false }: { day: number; cards: Word[]; userId: string | undefined; only?: boolean }) {
  const [queue, setQueue] = useState(() => bothWays(cards));
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [missed, setMissed] = useState<Card[]>([]);
  const current = queue[index];
  const perfect = !current && counts.good === queue.length;

  useEffect(() => {
    if (perfect && !only) void markDayPassed(userId, day);
  }, [perfect, day, userId, only]);

  const grade = useCallback(
    (g: Grade) => {
      if (!current || !flipped) return;
      setCounts((c) => ({ ...c, [g]: c[g] + 1 }));
      if (g !== 'good') setMissed((m) => [...m, current]);
      setIndex((i) => i + 1);
      setFlipped(false);
    },
    [current, flipped],
  );

  function retry() {
    setQueue((q) => bothWays(shuffle(q.filter((c) => !c.reverse))));
    setRound((r) => r + 1);
    setIndex(0);
    setFlipped(false);
    setCounts(NO_COUNTS);
    setMissed([]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      const match = GRADES.find((g) => g.key === e.key);
      if (match) grade(match.grade);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grade]);

  const half = queue.length / 2;
  // A word missed both ways is listed once.
  const missedWords = [...new Map(missed.map((c) => [c.item.id, c.item])).values()];
  const score = testScore(counts.good, queue.length);

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <Link to={`/daily/${day}`} className="back-link">
          <BackIcon />
          {day}일차
        </Link>
        {current && (
          <span className="study-counts small">
            {only && <span className="muted">오늘 단어만</span>}
            {round > 1 && <span className="muted">{round}번째 도전</span>}
            <span className={current.reverse ? 'muted' : 'strong'}>
              일→한 {Math.min(index, half)} / {half}
            </span>
            <span className={current.reverse ? 'strong' : 'muted'}>
              한→일 {Math.max(0, index - half)} / {half}
            </span>
          </span>
        )}
      </header>

      {!current && perfect && only && (
        <div className="empty">
          <p className="daily-score daily-score--pass">100점</p>
          <h1>오늘 단어 {cards.length}개 완벽!</h1>
          <p className="muted">
            일→한, 한→일 {queue.length}개 모두 알았어요{round > 1 ? ` · ${round}번 만에` : ''}. 이제 테스트로 {day}일차를 통과해 보세요.
          </p>
          <div className="button-row">
            <Link to={`/daily/${day}/test`} className="btn btn--primary">
              테스트 보기
            </Link>
            <Link to={`/daily/${day}`} className="btn btn--ghost">
              단어 다시 보기
            </Link>
          </div>
        </div>
      )}

      {!current && perfect && !only && (
        <div className="empty">
          <p className="daily-score daily-score--pass">100점</p>
          <h1>{day}일차 통과!</h1>
          <p className="muted">
            {queue.length}개 모두 알았어요{round > 1 ? ` · ${round}번 만에 통과` : ''}. 하루 단어 목록에 {day}일차가 색칠됐어요.
          </p>
          <div className="button-row">
            {day < DAILY_DAYS && (
              <Link to={`/daily/${day + 1}`} className="btn btn--primary">
                {day + 1}일차로
              </Link>
            )}
            <Link to="/daily" className="btn btn--ghost">
              목록 보기
            </Link>
          </div>
        </div>
      )}

      {!current && !perfect && (
        <div className="empty">
          <p className="daily-score">{score}점</p>
          <h1>100점이 될 때까지 다시!</h1>
          <p className="muted">
            {queue.length}개 중 알았음 {counts.good} · 헷갈림 {counts.hard} · 몰랐음 {counts.again}.{' '}
            {only ? '오늘 단어 연습이라 통과 기록에는 안 남아요.' : `모두 알았음이어야 ${day}일차가 통과돼요.`}
          </p>
          <ul className="daily-missed">
            {missedWords.map((item) => (
              <li key={item.id}>
                <span lang="ja">{dailyLabel(item)}</span>
                <span className="muted">{item.meaning}</span>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={retry}>
              다시 하기
            </button>
            <Link to={`/daily/${day}`} className="btn btn--ghost">
              단어 다시 보기
            </Link>
          </div>
        </div>
      )}

      {current && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          {index === half && <p className="daily-turn small">이제 거꾸로! 한국어 뜻을 보고 일본어를 떠올려요.</p>}
          {current.reverse ? (
            <ReverseCard
              key={`${round}-r-${current.item.id}`}
              item={current.item}
              tag={current.earlier ? '전 날 단어 · 한→일' : `${day}일차 · 한→일`}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />
          ) : (
            <Flashcard
              key={`${round}-${current.item.id}`}
              item={current.item}
              tag={current.earlier ? '전 날 단어' : `${day}일차`}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />
          )}
          {flipped ? (
            <div className="grade-row">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  type="button"
                  className={`btn grade-btn grade-btn--${g.grade}`}
                  onClick={() => grade(g.grade)}
                >
                  {g.label}
                  <kbd className="kbd">{g.key}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small center">카드를 눌러 뒤집은 뒤, 아래 버튼으로 얼마나 알았는지 골라요.</p>
          )}
        </>
      )}
    </div>
  );
}

/** 한→일: the Korean meaning up front; flipped, the word as ひらがな(漢字) with its sound, voice and example. */
function ReverseCard({ item, tag, flipped, onFlip }: { item: Item; tag: string; flipped: boolean; onFlip: () => void }) {
  return (
    <div className="flashcard">
      <span className="flashcard-tag">{tag}</span>
      {flipped && (
        <div className="flashcard-speak">
          <SpeakButton text={item.term} />
        </div>
      )}
      <button
        type="button"
        className="flashcard-face"
        aria-label={flipped ? `${item.meaning}, 뒷면` : `${item.meaning}, 눌러서 뒤집기`}
        onClick={onFlip}
      >
        <span className="flashcard-term daily-reverse-term">{item.meaning}</span>
        {flipped ? (
          <span className="flashcard-back">
            <span lang="ja" className="daily-reverse-ja">
              {dailyLabel(item)}
            </span>
            <span className="flashcard-sound">{toHangul(item.reading)}</span>
            {item.example_ja && (
              <span className="flashcard-example">
                <span lang="ja">{item.example_ja}</span>
                <span>{item.example_ko}</span>
              </span>
            )}
          </span>
        ) : (
          <span className="flashcard-hint">일본어로 떠올려 보고 탭</span>
        )}
      </button>
    </div>
  );
}
