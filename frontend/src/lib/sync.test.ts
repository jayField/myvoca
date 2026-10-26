import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for the Supabase tables. Reads answer slowly and deletes quickly, so a sync
// can read rows on the server just before a reset deletes them and only hear back afterwards.
const tables: Record<string, Record<string, unknown>[]> = { progress: [], day_counts: [], user_settings: [] };
const READ_MS = 50;
const WRITE_MS = 5;
const later = <T>(value: T, ms = WRITE_MS) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function likeToRegex(pattern: string) {
  return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`);
}

function query(table: string) {
  return {
    select: () => {
      const rows = tables[table].map((r) => ({ ...r }));
      return {
        then: (resolve: (v: unknown) => void) => later({ data: rows, error: null }, READ_MS).then(resolve),
        maybeSingle: () => later({ data: rows[0] ?? null, error: null }, READ_MS),
      };
    },
    upsert: (input: Record<string, unknown> | Record<string, unknown>[]) => {
      const key = table === 'progress' ? 'item_id' : table === 'day_counts' ? 'day' : 'user_id';
      for (const row of Array.isArray(input) ? input : [input]) {
        tables[table] = [...tables[table].filter((r) => r[key] !== row[key]), row];
      }
      return later({ error: null });
    },
    delete: () => ({
      like: (column: string, pattern: string) => {
        tables[table] = tables[table].filter((r) => !likeToRegex(pattern).test(String(r[column])));
        return later({ error: null });
      },
      gte: () => {
        tables[table] = [];
        return later({ error: null });
      },
    }),
  };
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => query(table),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));

const { api } = await import('../api');
const { applyReview } = await import('./logic');
const storage = await import('./storage');
const { syncNow } = await import('./sync');

beforeEach(async () => {
  tables.progress = [];
  tables.day_counts = [];
  tables.user_settings = [];
  await storage.clearAll();
});

describe('sync and reset', () => {
  it('a deck reset keeps 헷갈리는 단어 on the account but starts the deck over', async () => {
    const plan = await api.today();
    const [missed, ...known] = plan.new_items;
    await api.review(missed.id, 'again');
    for (const item of known) await api.review(item.id, 'good');
    await syncNow('user-1');

    await api.resetDeck('hiragana');
    await syncNow('user-1');

    expect(tables.progress.map((p) => [p.item_id, p.reset_on])).toEqual([[missed.id, expect.any(String)]]);
    expect((await api.decks()).confusing).toBe(1);
    const after = await api.today();
    expect(after.new_items.map((i) => i.id)).toContain(missed.id);
    expect(after.reviews).toEqual([]);
  });

  it('a sync already running when a deck is reset does not bring the reset words back', async () => {
    const plan = await api.today();
    for (const item of plan.new_items) await api.review(item.id, 'good');
    await syncNow('user-1');
    expect(tables.progress).toHaveLength(10);

    // The sync starts first (reads the server), the reset lands while it is still in flight.
    const sync = syncNow('user-1');
    await api.resetDeck('hiragana');
    await sync;
    await syncNow('user-1');

    expect(tables.progress).toHaveLength(0);
    const after = await api.today();
    expect(after.new_done).toBe(0);
    expect(after.new_items).toHaveLength(10);
  });

  it('reset all clears the server and this device even with a sync in flight', async () => {
    await storage.saveReview(applyReview(undefined, 'n5:猫', 'good', '2026-10-21'), '2026-10-21');
    await syncNow('user-1');
    const sync = syncNow('user-1');
    await api.resetAll();
    await sync;
    await syncNow('user-1');
    expect(tables.progress).toHaveLength(0);
    expect(tables.day_counts).toHaveLength(0);
    expect((await storage.loadSnapshot()).progress).toHaveLength(0);
  });
});
