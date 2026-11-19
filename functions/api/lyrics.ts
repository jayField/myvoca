// Cloudflare Pages Function: POST /api/lyrics
// Gives each line of a song's lyrics its reading, its words (to space the Hangul pronunciation) and a
// Korean meaning, in one Gemini call for the whole song so every line is read in context.
import { cleanWords, fail, failure, generate, guard, json, WORDS_RULE, WORDS_SCHEMA, type Env, type Word } from '../_shared/gemini';

const MAX_LINES = 150;
const MAX_LINE = 200;
const MAX_TOTAL = 8000;

const SYSTEM = `You help a Korean learner of Japanese study a song's lyrics line by line.
The input is the song's lyric lines, each prefixed with its number ("3: 夢をのせた"). Lines are often fragments of one sentence; read them together so each meaning fits the song, but translate every line on its own. Lines in parentheses are backing vocals; translate them too, keeping the parentheses.
For every line return:
- n: the line's number
- reading: the whole line in hiragana (katakana words such as シャララララ stay katakana; keep the parentheses)
- meaning: a short, natural Korean translation of that line, as a lyric would be translated
- words: the line split into its words in order. ${WORDS_RULE}`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { n: { type: 'INTEGER' }, reading: { type: 'STRING' }, meaning: { type: 'STRING' }, words: WORDS_SCHEMA },
        required: ['n', 'reading', 'meaning', 'words'],
      },
    },
  },
  required: ['lines'],
};

interface Explained {
  reading: string;
  meaning: string;
  words: Word[];
}

const OPENING = /^[（(「『]+$/;
const CLOSING = /^[）)」』、。！？!?…〜~]+$/;

/** Brackets and punctuation stick to the word they belong to, so (えがいてる) reads (에가이테루), not ( 에가이테루 ). */
function tidy(words: Word[]): Word[] {
  return words.map((w, i) => ({
    ...w,
    attach: w.attach || CLOSING.test(w.japanese) || (i > 0 && OPENING.test(words[i - 1].japanese)),
  }));
}

/**
 * The line's reading: Gemini's word-by-word readings are steadier than its whole-line one (which now and
 * then gains a stray kana), so when the words spell the line exactly their readings are used.
 */
function lineReading(line: string, reading: string, words: Word[]): string {
  const plain = (text: string) => text.replace(/\s+/g, '');
  if (words.length && plain(words.map((w) => w.japanese).join('')) === plain(line)) return words.map((w) => w.reading).join('');
  return reading;
}

async function explain(env: Env, lines: string[]): Promise<Explained[]> {
  const parsed = await generate(env, SYSTEM, SCHEMA, lines.map((line, i) => `${i + 1}: ${line}`).join('\n'));
  const out: Explained[] = lines.map(() => ({ reading: '', meaning: '', words: [] }));
  for (const item of Array.isArray(parsed.lines) ? (parsed.lines as Record<string, unknown>[]) : []) {
    const i = Number(item?.n) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= lines.length) continue;
    const words = tidy(cleanWords(item.words));
    out[i] = {
      reading: lineReading(lines[i], typeof item.reading === 'string' ? item.reading.trim() : '', words),
      meaning: typeof item.meaning === 'string' ? item.meaning.trim() : '',
      words,
    };
  }
  // A line or two left out still plays fine; most of the song missing means the answer went wrong.
  if (out.filter((line) => line.meaning).length < lines.length / 2) throw new Error(`gemini explained too few lines: ${JSON.stringify(parsed)}`);
  return out;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const blocked = await guard(request, env);
  if (blocked) return blocked;

  let lines: string[] = [];
  try {
    const body = (await request.json()) as { lines?: unknown };
    if (Array.isArray(body.lines)) lines = body.lines.filter((line): line is string => typeof line === 'string').map((line) => line.trim());
  } catch {
    // Falls through to the empty-lyrics error.
  }
  if (!lines.length || lines.some((line) => !line)) return fail(400, '해석할 가사가 없어요.');
  if (lines.length > MAX_LINES || lines.some((line) => line.length > MAX_LINE) || lines.join('').length > MAX_TOTAL) {
    return fail(400, '가사가 너무 길어요.');
  }

  try {
    return json({ lines: await explain(env, lines) });
  } catch (e) {
    return failure(e, '가사 해석');
  }
}
