// Set how each JLPT word is written at its deck's level, the way the test itself prints it:
// a word whose kanji are all within the level (cumulative, e.g. N4 includes N5) keeps its kanji;
// otherwise it is shown in kana, with the kanji as a small hint next to it.
//
//   node scripts/apply-notation.mjs
//
// `term` (the kanji form) stays the item's ID and the text sent to the speech engine, so learning
// records and recordings are unaffected; the kana form goes in `display`. Re-run after adding words.
// Kanji levels (scripts/jlpt-kanji.json) follow the common unofficial lists (Waller's), since the
// official lists have not been published since 2010.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const LEVELS = JSON.parse(readFileSync(join(ROOT, 'scripts', 'jlpt-kanji.json'), 'utf8'));
const DECKS = [
  ['n5', ['n5']],
  ['n4', ['n5', 'n4']],
  ['n3', ['n5', 'n4', 'n3']],
];

const isKanji = (c) => /\p{Script=Han}/u.test(c) && c !== '々';

for (const [deck, levels] of DECKS) {
  const allowed = new Set(levels.flatMap((l) => [...LEVELS[l]]));
  const file = join(DATA_DIR, `${deck}.json`);
  const items = JSON.parse(readFileSync(file, 'utf8'));
  let kana = 0;
  const updated = items.map(({ display: _old, ...item }) => {
    const beyond = [...item.term].some((c) => isKanji(c) && !allowed.has(c));
    if (!beyond) return item;
    kana++;
    // Keep `display` right after `term` so the files stay easy to read.
    const { term, ...rest } = item;
    return { term, display: item.reading, ...rest };
  });
  writeFileSync(file, `${JSON.stringify(updated, null, 1)}\n`);
  console.log(`${deck}: ${kana}/${items.length} words shown in kana`);
}
