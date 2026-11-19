// Cloudflare Pages Function: POST /api/translate
// Turns what a learner typed (usually Japanese written in Hangul, e.g. 고항 타베타이) into the
// Japanese they meant, with its reading and Korean meaning, via the Gemini API.
// The Gemini key lives only on the server (Pages secret GEMINI_API_KEY); the browser never sees it,
// and only signed-in accounts may use it.
import { cleanWords, fail, failure, generate, guard, json, WORDS_SCHEMA, type Env, type Word } from '../_shared/gemini';

const MAX_INPUT = 100;

const SYSTEM = `You help a Korean learner of Japanese save expressions they picked up chatting with Japanese speakers.
The input is usually Japanese written in Hangul by how it sounds (e.g. 아리가또 → ありがとう, 고항 타베타이 → ご飯食べたい), often misspelled: long vowels, small っ and voicing are frequently wrong or missing. It may also be a Korean sentence to say in Japanese, or Japanese text.
First decide what the input is (input_kind):
- "korean": real Korean words and Korean grammar endings (친해지다, 진짜, 고마워, -ㅂ니다, -어요, -고 싶어, -았다). Translate its meaning faithfully into natural Japanese: 진짜 친해집니다 → 本当に仲良くなります. Never swap it for a stock phrase that only sounds alike (친해집니다 is not お世話になります).
- "japanese_sound": Japanese written in Hangul by sound, which is not meaningful Korean (오하요, 아리가또, 고항 타베타이, 키미오 오못테이루). Work out the Japanese the learner heard and correct its spelling.
- "japanese": Japanese script.
When unsure between the first two, ask whether a Korean speaker would read it as ordinary Korean; if so it is "korean".
The input is always a whole expression the learner heard, never a grammar pattern to explain: 타베타이 is 食べたい "먹고 싶다", not the ~たい pattern. When a sound could be either a full word or a grammar ending (미타이: 見たい "보고 싶다" or みたい "~같다"), choose the full word.
Return:
- input_kind: "korean", "japanese_sound" or "japanese", decided as above before anything else
- japanese: the expression as normally written (kanji where natural, otherwise kana)
- reading: the whole expression in hiragana (katakana loanwords stay katakana)
- meaning: short, natural Korean translation of this exact expression with its own words (食べたい → 먹고 싶다). Never a pattern with ~ or placeholders like ~하고 싶다
- words: the expression split into its words in order, used to space its pronunciation. Keep a verb with its endings together (考えている, 食べたい) and give each particle its own entry. Each has japanese (as written in the expression), reading (hiragana) and attach: true when Korean-style spacing would write it joined to the word before (particles, も, です after a noun), so 君を思っている reads 君を 思っている. Joined, the japanese parts must spell the expression exactly. A one-word expression has a single entry.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    input_kind: { type: 'STRING', enum: ['korean', 'japanese_sound', 'japanese'] },
    japanese: { type: 'STRING' },
    reading: { type: 'STRING' },
    meaning: { type: 'STRING' },
    words: WORDS_SCHEMA,
  },
  required: ['input_kind', 'japanese', 'reading', 'meaning', 'words'],
  // Decide what the input is before translating it, so Korean is not misread as Japanese sounds.
  propertyOrdering: ['input_kind', 'japanese', 'reading', 'meaning', 'words'],
};

const FIELDS = ['japanese', 'reading', 'meaning'] as const;
type Translation = Record<(typeof FIELDS)[number], string> & { words: Word[] };

async function translate(env: Env, input: string): Promise<Translation> {
  const parsed = await generate(env, SYSTEM, SCHEMA, input);
  const out = {
    ...Object.fromEntries(FIELDS.map((f) => [f, typeof parsed[f] === 'string' ? (parsed[f] as string).trim() : ''])),
    words: cleanWords(parsed.words),
  } as Translation;
  if (!out.japanese || !out.reading || !out.meaning) throw new Error(`gemini returned an incomplete result: ${JSON.stringify(parsed)}`);
  return out;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const blocked = await guard(request, env);
  if (blocked) return blocked;

  let input = '';
  try {
    const body = (await request.json()) as { input?: unknown };
    input = typeof body.input === 'string' ? body.input.trim() : '';
  } catch {
    // Falls through to the empty-input error.
  }
  if (!input) return fail(400, '번역할 표현을 입력해 주세요.');
  if (input.length > MAX_INPUT) return fail(400, `${MAX_INPUT}자 이내로 입력해 주세요.`);

  try {
    return json({ result: await translate(env, input) });
  } catch (e) {
    return failure(e, '번역');
  }
}
