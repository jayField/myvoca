import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyReview } from './logic';
import {
  clearAll,
  clearStudyData,
  deleteProgress,
  getOwner,
  getProgress,
  loadSnapshot,
  mergeRemote,
  replaceAll,
  saveReview,
  saveSettings,
  setOwner,
} from './storage';

const T1 = '2026-10-21T01:00:00.000Z';
const T2 = '2026-10-21T02:00:00.000Z';

beforeEach(async () => {
  await clearAll();
});

describe('storage', () => {
  it('saves reviews, counts them per day and replaces everything from a backup', async () => {
    const first = applyReview(undefined, 'hiragana:あ', 'good', '2026-10-21', T1);
    await saveReview(first, '2026-10-21');
    await saveReview(applyReview(first, 'hiragana:あ', 'again', '2026-10-21', T2), '2026-10-21');
    await saveSettings({ deck_id: 'n5', daily_new: 5, order: 'random', include_reviews: true }, T1);

    expect((await getProgress('hiragana:あ'))?.last_grade).toBe('again');
    let snap = await loadSnapshot();
    expect(snap.days).toEqual([{ day: '2026-10-21', count: 2 }]);
    expect(snap.settings).toEqual({ value: { deck_id: 'n5', daily_new: 5, order: 'random', include_reviews: true }, updated_at: T1 });

    await setOwner('user-a');
    await replaceAll({ progress: [], days: [{ day: '2026-10-01', count: 4 }], settings: null });
    snap = await loadSnapshot();
    expect(snap).toEqual({ progress: [], days: [{ day: '2026-10-01', count: 4 }], settings: null });
    expect(await getOwner()).toBe('user-a');
  });

  it('merges a server copy: newer progress and settings win, larger day counts win', async () => {
    const localOld = applyReview(undefined, 'n5:猫', 'good', '2026-10-20', T1);
    const localNew = applyReview(undefined, 'n5:犬', 'good', '2026-10-20', T2);
    await saveReview(localOld, '2026-10-20');
    await saveReview(localNew, '2026-10-20');
    await saveSettings({ deck_id: 'hiragana', daily_new: 10, order: 'sequential', include_reviews: true }, T2);

    const changed = await mergeRemote({
      progress: [
        { ...localOld, last_grade: 'again', updated_at: T2 },
        { ...localNew, last_grade: 'again', updated_at: T1 },
        applyReview(undefined, 'n5:水', 'hard', '2026-10-19', T1),
      ],
      days: [
        { day: '2026-10-20', count: 1 },
        { day: '2026-10-19', count: 3 },
      ],
      settings: { value: { deck_id: 'n5', daily_new: 5, order: 'random', include_reviews: true }, updated_at: T1 },
    });

    expect(changed).toBe(true);
    expect((await getProgress('n5:猫'))?.last_grade).toBe('again');
    expect((await getProgress('n5:犬'))?.last_grade).toBe('good');
    expect((await getProgress('n5:水'))?.last_grade).toBe('hard');
    const snap = await loadSnapshot();
    expect(snap.days.sort((a, b) => a.day.localeCompare(b.day))).toEqual([
      { day: '2026-10-19', count: 3 },
      { day: '2026-10-20', count: 2 },
    ]);
    expect(snap.settings?.value.deck_id).toBe('hiragana');
  });

  it('reports no change when the server has nothing newer', async () => {
    const p = applyReview(undefined, 'n5:猫', 'good', '2026-10-20', T2);
    await saveReview(p, '2026-10-20');
    expect(await mergeRemote({ progress: [{ ...p, updated_at: T1 }], days: [], settings: null })).toBe(false);
  });

  it('clearAll forgets the owner too', async () => {
    await setOwner('user-a');
    await clearAll();
    expect(await getOwner()).toBeNull();
  });

  it('deleteProgress removes only the given items; clearStudyData keeps settings and owner', async () => {
    await saveReview(applyReview(undefined, 'n5:猫', 'good', '2026-10-21', T1), '2026-10-21');
    await saveReview(applyReview(undefined, 'n4:会議', 'good', '2026-10-21', T1), '2026-10-21');
    await saveSettings({ deck_id: 'n4', daily_new: 5, order: 'random', include_reviews: true }, T1);
    await setOwner('user-a');

    await deleteProgress(['n5:猫']);
    expect(await getProgress('n5:猫')).toBeUndefined();
    expect(await getProgress('n4:会議')).toBeDefined();

    await clearStudyData();
    const snap = await loadSnapshot();
    expect(snap.progress).toEqual([]);
    expect(snap.days).toEqual([]);
    expect(snap.settings?.value.deck_id).toBe('n4');
    expect(await getOwner()).toBe('user-a');
  });
});
