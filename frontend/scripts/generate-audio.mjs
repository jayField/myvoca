// Pre-generate pronunciation audio for every bundled word with a local VOICEVOX engine.
// The site ships the resulting files, so no speech service runs at request time.
//
//   docker run -d --rm --name voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
//   node scripts/generate-audio.mjs --speaker 30 --credit "VOICEVOX:No.7"
//
// Files are AAC (.m4a) converted with macOS `afconvert`, named by a hash of speaker + text,
// so re-running only synthesizes words that are new or whose speaker changed.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const OUT_DIR = join(ROOT, 'public', 'audio');
const MANIFEST = join(OUT_DIR, 'manifest.json');
const DECK_FILES = ['hiragana.json', 'katakana.json', 'n5.json', 'n4.json', 'n3.json'];
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function synthesizeWav(text, speaker) {
  const query = await fetch(`${ENGINE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, {
    method: 'POST',
  });
  if (!query.ok) throw new Error(`audio_query ${query.status} for ${text}`);
  const wav = await fetch(`${ENGINE}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await query.text(),
  });
  if (!wav.ok) throw new Error(`synthesis ${wav.status} for ${text}`);
  return Buffer.from(await wav.arrayBuffer());
}

/** Every distinct text the app can speak: each item's term. */
function allTexts() {
  const texts = new Set();
  for (const file of DECK_FILES) {
    for (const item of JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))) texts.add(item.term);
  }
  return [...texts];
}

const fileName = (speaker, text) =>
  `${createHash('sha1').update(`voicevox:${speaker}\n${text}`).digest('hex').slice(0, 16)}.m4a`;

const speaker = arg('speaker');
const credit = arg('credit');
if (!speaker || !credit) {
  console.log('usage: --speaker <style id> --credit "VOICEVOX:<character>"');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'tango-audio-'));
const texts = allTexts();
const manifest = { engine: 'VOICEVOX', speaker: Number(speaker), credit, files: {} };
let made = 0;
try {
  for (const text of texts) {
    const name = fileName(speaker, text);
    manifest.files[text] = name;
    const out = join(OUT_DIR, name);
    if (existsSync(out)) continue;
    const wav = join(work, 'clip.wav');
    writeFileSync(wav, await synthesizeWav(text, speaker));
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, out]);
    if (++made % 100 === 0) console.log(`  ${made} made`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
writeFileSync(MANIFEST, JSON.stringify(manifest) + '\n');
console.log(`${texts.length} texts, ${made} newly synthesized, manifest written`);
