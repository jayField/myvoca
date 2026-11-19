// Shared by the Pages Functions that call Gemini: sign-in check, the Gemini call itself, and turning its
// failures into messages the app can show. The key lives only in the Pages secret GEMINI_API_KEY.

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export interface Word {
  japanese: string;
  reading: string;
  /** Written joined to the word before when spaced Korean-style (particles). */
  attach: boolean;
}

/** How Gemini should split Japanese into words to space its pronunciation; shared by every prompt. */
export const WORDS_RULE =
  'Keep a verb with its endings together (考えている, 食べたい) and give each particle its own entry. Each has japanese (as written), reading (hiragana) and attach: true when Korean-style spacing would write it joined to the word before (particles, も, です after a noun), so 君を思っている reads 君を 思っている. Joined, the japanese parts must spell the text exactly. A one-word text has a single entry.';

export const WORDS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { japanese: { type: 'STRING' }, reading: { type: 'STRING' }, attach: { type: 'BOOLEAN' } },
    required: ['japanese', 'reading', 'attach'],
  },
};

const MAX_WORDS = 30;

/** Keeps only well-formed word entries; they only space the pronunciation, so a bad one is dropped rather than failing. */
export function cleanWords(value: unknown): Word[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((w): w is Word => !!w && typeof w.japanese === 'string' && typeof w.reading === 'string')
    .map((w) => ({ japanese: w.japanese.trim(), reading: w.reading.trim(), attach: w.attach === true }))
    .filter((w) => w.japanese)
    .slice(0, MAX_WORDS);
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const fail = (status: number, error: string) => json({ error }, status);

/** Whether the token belongs to a signed-in account of this app. */
async function isSignedIn(env: Env, token: string): Promise<boolean> {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return true;
}

/**
 * Checks setup and sign-in before any Gemini call. Returns the response to send when the request
 * can't go ahead, or null when it can.
 */
export async function guard(request: Request, env: Env): Promise<Response | null> {
  // Name what is missing (never the values) so a setup slip is easy to spot in the app.
  const missing = (['GEMINI_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const).filter((name) => !env[name]);
  if (missing.length) return fail(500, `번역 설정이 아직 안 됐어요. 관리자에게 알려 주세요. (빠진 설정: ${missing.join(', ')})`);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, '로그인이 필요해요.');
  try {
    if (!(await isSignedIn(env, token))) return fail(401, '로그인이 필요해요. 다시 로그인해 주세요.');
  } catch (e) {
    console.error(e);
    return fail(502, '로그인을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
  return null;
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

/** One structured-output Gemini call; returns the parsed JSON object it answered with. */
export async function generate(env: Env, system: string, schema: unknown, input: string): Promise<Record<string, unknown>> {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
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
  return JSON.parse(text) as Record<string, unknown>;
}

/** The response for a failed Gemini call, worded for what the app was doing (`doing`: 번역 or 가사 해석). */
export function failure(e: unknown, doing: string): Response {
  console.error(e);
  if (e instanceof QuotaError) {
    return /PerMinute|per minute/i.test(e.message)
      ? fail(429, `${doing} 요청이 잠깐 몰렸어요. 1분쯤 뒤에 다시 해 주세요.`)
      : fail(429, `오늘 ${doing} 무료 사용량을 다 썼어요. 내일 다시 해 주세요.`);
  }
  const object = doing === '번역' ? '번역하지' : `${doing}을 하지`;
  if (e instanceof GeminiError) return fail(502, `${object} 못했어요. 잠시 뒤 다시 시도해 주세요. (Gemini ${e.status}: ${e.reason})`);
  return fail(502, `${object} 못했어요. 잠시 뒤 다시 시도해 주세요.`);
}
