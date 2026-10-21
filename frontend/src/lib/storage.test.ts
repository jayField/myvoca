import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { applyReview } from './logic';
import { getProgress, loadSnapshot, replaceAll, saveReview, saveSettings } from './storage';

describe('storage', () => {
  it('saves reviews, counts them per day and replaces everything from a backup', async () => {
    const first = applyReview(undefined, 'hiragana:あ', 'good', '2026-10-21');
    await saveReview(first, '2026-10-21');
    await saveReview(applyReview(first, 'hiragana:あ', 'again', '2026-10-21'), '2026-10-21');
    await saveSettings({ deck_id: 'n5', daily_new: 5, order: 'random' });

    expect((await getProgress('hiragana:あ'))?.last_grade).toBe('again');
    let snap = await loadSnapshot();
    expect(snap.days).toEqual([{ day: '2026-10-21', count: 2 }]);
    expect(snap.settings).toEqual({ deck_id: 'n5', daily_new: 5, order: 'random' });

    await replaceAll({ progress: [], days: [{ day: '2026-10-01', count: 4 }], settings: null });
    snap = await loadSnapshot();
    expect(snap).toEqual({ progress: [], days: [{ day: '2026-10-01', count: 4 }], settings: null });
  });
});
