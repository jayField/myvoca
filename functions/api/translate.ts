// Cloudflare Pages Function: POST /api/translate
// Turns what a learner typed (usually Japanese written in Hangul, e.g. 고항 타베타이) into the
// Japanese they meant, with reading, Korean meaning and an example, via the Gemini API.
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
The input is always a whole expression the learner heard, never a grammar pattern to explain: 타베타이 is 食べたい "먹고 싶다", not the ~たい pattern. When a sound could be either a full word or a grammar ending (미타이: 見たい "보고 싶다" or みたい "~같다"), choose the full word and mention the other reading in note.
Return:
- japanese: the expression as normally written (kanji where natural, otherwise kana)
- reading: the whole expression in hiragana (katakana loanwords stay katakana)
- meaning: short, natural Korean translation of this exact expression with its own words (食べたい → 먹고 싶다). Never a pattern with ~ or placeholders like ~하고 싶다
- note: one short Korean sentence on nuance or politeness, or on how the input was corrected; empty if nothing to add
- example_ja: one natural, everyday example sentence in Japanese (Japanese script only, never Hangul) using the expression
- example_ko: the Korean translation of example_ja (Hangul)`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    japanese: { type: 'STRING' },
    reading: { type: 'STRING' },
    meaning: { type: 'STRING' },
    note: { type: 'STRING' },
    example_ja: { type: 'STRING' },
    example_ko: { type: 'STRING' },
  },
  required: ['japanese', 'reading', 'meaning', 'note', 'example_ja', 'example_ko'],
};

const FIELDS = ['japanese', 'reading', 'meaning', 'note', 'example_ja', 'example_ko'] as const;
type Translation = Record<(typeof FIELDS)[number], string>;

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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  if (res.status === 429) throw new QuotaError(await res.text());
  if (!res.ok) throw new GeminiError(res.status, await geminiReason(res));
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const out = Object.fromEntries(FIELDS.map((f) => [f, typeof parsed[f] === 'string' ? (parsed[f] as string).trim() : ''])) as Translation;
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
