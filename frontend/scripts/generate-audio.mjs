// Pre-generate pronunciation audio for every bundled word with a local VOICEVOX engine.
// The site ships the resulting files, so no speech service runs at request time.
//
//   docker run -d --rm --name voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
//   node scripts/generate-audio.mjs --speaker 30 --speed 0.75 --credit "VOICEVOX:No.7"
//
// Files are AAC (.m4a) converted with macOS `afconvert`, named by a hash of speaker + speed + text,
// so re-running only synthesizes words that are new or whose voice settings changed; files no
// longer referenced are deleted.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

async function synthesizeWav(text, speaker, speed) {
  const query = await fetch(`${ENGINE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, {
    method: 'POST',
  });
  if (!query.ok) throw new Error(`audio_query ${query.status} for ${text}`);
  const wav = await fetch(`${ENGINE}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(await query.json()), speedScale: speed }),
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

const fileName = (speaker, speed, text) =>
  `${createHash('sha1').update(`voicevox:${speaker}:${speed}\n${text}`).digest('hex').slice(0, 16)}.m4a`;

const speaker = arg('speaker');
const speed = Number(arg('speed') ?? 1);
const credit = arg('credit');
if (!speaker || !credit || !(speed > 0)) {
  console.log('usage: --speaker <style id> [--speed 0.75] --credit "VOICEVOX:<character>"');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'tango-audio-'));
const texts = allTexts();
const manifest = { engine: 'VOICEVOX', speaker: Number(speaker), speed, credit, files: {} };
let made = 0;
try {
  for (const text of texts) {
    const name = fileName(speaker, speed, text);
    manifest.files[text] = name;
    const out = join(OUT_DIR, name);
    if (existsSync(out)) continue;
    const wav = join(work, 'clip.wav');
    writeFileSync(wav, await synthesizeWav(text, speaker, speed));
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, out]);
    if (++made % 100 === 0) console.log(`  ${made} made`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
writeFileSync(MANIFEST, JSON.stringify(manifest) + '\n');
const keep = new Set(Object.values(manifest.files));
const stale = readdirSync(OUT_DIR).filter((f) => f.endsWith('.m4a') && !keep.has(f));
stale.forEach((f) => rmSync(join(OUT_DIR, f)));
console.log(`${texts.length} texts, ${made} newly synthesized, ${stale.length} stale removed, manifest written`);
