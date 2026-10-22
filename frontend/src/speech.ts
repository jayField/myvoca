// Japanese pronunciation: pre-generated VOICEVOX recordings when available
// (public/audio, made by scripts/generate-audio.mjs), otherwise the browser's built-in voice.

// Female Japanese voices shipped by Chrome, macOS/iOS, Windows and Edge, best first.
const FEMALE_VOICES = ['Google 日本語', 'Nanami', 'O-Ren', 'Kyoko', 'Ayumi', 'Haruka', 'Sayaka', 'Mizuki', 'Flo', 'Shelley', 'Sandy'];
const MALE_VOICES = ['Otoya', 'Hattori', 'Ichiro', 'Keita', 'Daichi', 'Naoki', 'Eddy', 'Reed', 'Rocko', 'Grandpa'];

/** VOICEVOX's terms require naming the voice wherever its audio is used. */
export const VOICE_CREDIT = 'VOICEVOX:No.7';

let cachedVoice: SpeechSynthesisVoice | null = null;
let recordings: Promise<Record<string, string>> | null = null;
/** The loaded list, kept so a tap can start playback synchronously, inside the click itself. */
let loadedFiles: Record<string, string> | null = null;
let current: HTMLAudioElement | null = null;

function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || canUseSpeechSynthesis());
}

function loadRecordings(): Promise<Record<string, string>> {
  recordings ??= fetch('/audio/manifest.json')
    .then((res) => (res.ok ? res.json() : { files: {} }))
    .then((m: { files?: Record<string, string> }) => (loadedFiles = m.files ?? {}))
    .catch(() => (loadedFiles = {}));
  return recordings;
}

if (typeof window !== 'undefined') {
  // Fetch the list early so the first tap plays without waiting on it.
  void loadRecordings();
  if (canUseSpeechSynthesis()) {
    // Chrome fills the voice list asynchronously; pick again once it arrives.
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      cachedVoice = null;
    });
  }
}

function japaneseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const ja = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  if (ja.length === 0) return null;
  const female = FEMALE_VOICES.map((name) => ja.find((v) => v.name.includes(name))).find(Boolean);
  cachedVoice = female ?? ja.find((v) => !MALE_VOICES.some((m) => v.name.includes(m))) ?? ja[0];
  return cachedVoice;
}

function speakWithBrowser(text: string) {
  if (!canUseSpeechSynthesis()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  const voice = japaneseVoice();
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// Safari and iOS only allow sound that starts within the tap itself, so playback must begin
// synchronously here; waiting on a promise first gets it (and the fallback voice) blocked.
export function speak(text: string): void {
  if (typeof window === 'undefined') return;
  current?.pause();
  const file = loadedFiles?.[text];
  if (!file) {
    speakWithBrowser(text);
    void loadRecordings();
    return;
  }
  if (canUseSpeechSynthesis()) speechSynthesis.cancel();
  current = new Audio(`/audio/${file}`);
  current.play().catch((e: unknown) => {
    // A newer tap pausing this clip rejects with AbortError; that is not a failure, and falling back
    // would read the word again in a different (browser) voice. Only a clip that can't play falls back.
    if (e instanceof DOMException && e.name === 'NotSupportedError') speakWithBrowser(text);
  });
}
