// Cloudflare Pages Function: POST /api/translate
// Turns what a learner typed (usually Japanese written in Hangul, e.g. 고항 타베타이) into the
// Japanese they meant, with its reading and Korean meaning, via the Gemini API.
// The Gemini key lives only here (Pages secret GEMINI_API_KEY); the browser never sees it,
// and only signed-in accounts may use it.

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_INPUT = 100;

const SYSTEM = `You help a Korean learner of Japanese save expressions they picked up chatting with Japanese speakers.
The input is usually Japanese written in Hangul by how it sounds (e.g. 아리가또 → ありがとう, 고항 타베타이 → ご飯食べたい), often misspelled: long vowels, small っ and voicing are frequently wrong or missing. It may also be a Korean sentence to say in Japanese, or Japanese text.
Read Hangul as Japanese sounds first; treat it as Korean only when it clearly is Korean. Work out the natural Japanese expression the learner meant and correct it.
The input is always a whole expression the learner heard, never a grammar pattern to explain: 타베타이 is 食べたい "먹고 싶다", not the ~たい pattern. When a sound could be either a full word or a grammar ending (미타이: 見たい "보고 싶다" or みたい "~같다"), choose the full word.
Return:
- japanese: the expression as normally written (kanji where natural, otherwise kana)
- reading: the whole expression in hiragana (katakana loanwords stay katakana)
- meaning: short, natural Korean translation of this exact expression with its own words (食べたい → 먹고 싶다). Never a pattern with ~ or placeholders like ~하고 싶다
- words: the expression split into its words in order, used to space its pronunciation. Keep a verb with its endings together (考えている, 食べたい) and give each particle its own entry. Each has japanese (as written in the expression), reading (hiragana) and attach: true when Korean-style spacing would write it joined to the word before (particles, も, です after a noun), so 君を思っている reads 君を 思っている. Joined, the japanese parts must spell the expression exactly. A one-word expression has a single entry.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    japanese: { type: 'STRING' },
    reading: { type: 'STRING' },
    meaning: { type: 'STRING' },
    words: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { japanese: { type: 'STRING' }, reading: { type: 'STRING' }, attach: { type: 'BOOLEAN' } },
        required: ['japanese', 'reading', 'attach'],
      },
    },
  },
  required: ['japanese', 'reading', 'meaning', 'words'],
};

const FIELDS = ['japanese', 'reading', 'meaning'] as const;
interface Word {
  japanese: string;
  reading: string;
  /** Written joined to the word before when spaced Korean-style (particles). */
  attach: boolean;
}
type Translation = Record<(typeof FIELDS)[number], string> & { words: Word[] };

const MAX_WORDS = 30;

/** Keeps only well-formed word entries; they only space the pronunciation, so a bad one is dropped rather than failing. */
function cleanWords(value: unknown): Word[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((w): w is Word => !!w && typeof w.japanese === 'string' && typeof w.reading === 'string')
    .map((w) => ({ japanese: w.japanese.trim(), reading: w.reading.trim(), attach: w.attach === true }))
    .filter((w) => w.japanese)
    .slice(0, MAX_WORDS);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const fail = (status: number, error: string) => json({ error }, status);

/** Whether the token belongs to a signed-in account of this app. */
async function isSignedIn(env: Env, token: string): Promise<boolean> {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return true;
}

/** Gemini's own free-tier quota ran out: per minute (15 requests at the time of writing) or per day. */
class QuotaError extends Error {}

/** Gemini refused the call; `reason` is its own short message (never contains the key), shown to help fix setup. */
class GeminiError extends Error {
  status: number;
  reason: string;

  constructor(status: number, reason: string) {
    super(`gemini ${status}: ${reason}`);
    this.status = status;
    this.reason = reason;
  }
}

async function geminiReason(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return String((JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text).slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

async function translate(env: Env, input: string): Promise<Translation> {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
  let res = await call();
  // 503 means Gemini is briefly overloaded; one quiet retry usually gets through.
  if (res.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    res = await call();
  }
  if (res.status === 429) throw new QuotaError(await res.text());
  if (!res.ok) throw new GeminiError(res.status, await geminiReason(res));
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const out = {
    ...Object.fromEntries(FIELDS.map((f) => [f, typeof parsed[f] === 'string' ? (parsed[f] as string).trim() : ''])),
    words: cleanWords(parsed.words),
  } as Translation;
  if (!out.japanese || !out.reading || !out.meaning) throw new Error(`gemini returned an incomplete result: ${text}`);
  return out;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  // Name what is missing (never the values) so a setup slip is easy to spot in the app.
  const missing = (['GEMINI_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const).filter((name) => !env[name]);
  if (missing.length) return fail(500, `번역 설정이 아직 안 됐어요. 관리자에게 알려 주세요. (빠진 설정: ${missing.join(', ')})`);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, '로그인이 필요해요.');

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
    if (!(await isSignedIn(env, token))) return fail(401, '로그인이 필요해요. 다시 로그인해 주세요.');
  } catch (e) {
    console.error(e);
    return fail(502, '로그인을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }

  try {
    return json({ result: await translate(env, input) });
  } catch (e) {
    console.error(e);
    if (e instanceof QuotaError) {
      return /PerMinute|per minute/i.test(e.message)
        ? fail(429, '번역 요청이 잠깐 몰렸어요. 1분쯤 뒤에 다시 해 주세요.')
        : fail(429, '오늘 번역 무료 사용량을 다 썼어요. 내일 다시 해 주세요.');
    }
    if (e instanceof GeminiError) return fail(502, `번역하지 못했어요. 잠시 뒤 다시 시도해 주세요. (Gemini ${e.status}: ${e.reason})`);
    return fail(502, '번역하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
