// Japanese text-to-speech with the browser's built-in voices, preferring a female voice.

// Female Japanese voices shipped by Chrome, macOS/iOS, Windows and Edge, best first.
const FEMALE_VOICES = ['Google 日本語', 'Nanami', 'O-Ren', 'Kyoko', 'Ayumi', 'Haruka', 'Sayaka', 'Mizuki'];
const MALE_VOICES = ['Otoya', 'Hattori', 'Ichiro', 'Keita', 'Daichi', 'Naoki'];

let cachedVoice: SpeechSynthesisVoice | null = null;

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function japaneseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const ja = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  if (ja.length === 0) return null;
  const female = FEMALE_VOICES.map((name) => ja.find((v) => v.name.includes(name))).find(Boolean);
  cachedVoice = female ?? ja.find((v) => !MALE_VOICES.some((m) => v.name.includes(m))) ?? ja[0];
  return cachedVoice;
}

if (canSpeak()) {
  // Chrome fills the voice list asynchronously; pick again once it arrives.
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = null;
  });
}

export function speak(text: string): void {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  const voice = japaneseVoice();
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
