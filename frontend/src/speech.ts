// Japanese pronunciation with the browser's built-in voice, a clear female one where the device has it.
// Words and 회화 노트 phrases use the same voice.

// Female Japanese voices shipped by Chrome, macOS/iOS, Windows and Edge, best first.
const FEMALE_VOICES = ['Google 日本語', 'Nanami', 'O-Ren', 'Kyoko', 'Ayumi', 'Haruka', 'Sayaka', 'Mizuki', 'Flo', 'Shelley', 'Sandy'];
const MALE_VOICES = ['Otoya', 'Hattori', 'Ichiro', 'Keita', 'Daichi', 'Naoki', 'Eddy', 'Reed', 'Rocko', 'Grandpa'];

let cachedVoice: SpeechSynthesisVoice | null = null;

function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function canSpeak(): boolean {
  return canUseSpeechSynthesis();
}

if (canUseSpeechSynthesis()) {
  // Chrome fills the voice list asynchronously; pick again once it arrives.
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = null;
  });
}

function japaneseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const ja = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  if (ja.length === 0) return null;
  const female = FEMALE_VOICES.map((name) => ja.find((v) => v.name.includes(name))).find(Boolean);
  cachedVoice = female ?? ja.find((v) => !MALE_VOICES.some((m) => v.name.includes(m))) ?? ja[0];
  return cachedVoice;
}

// Safari and iOS only allow sound that starts within the tap itself, so this speaks synchronously.
export function speak(text: string): void {
  if (!canUseSpeechSynthesis()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  const voice = japaneseVoice();
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
