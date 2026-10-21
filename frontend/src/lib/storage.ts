// IndexedDB persistence: one object store each for progress, per-day counts and settings/ownership metadata.
import type { DayCount, Progress, Settings } from '../types';

const DB_NAME = 'tango-note';
const DB_VERSION = 1;
const PROGRESS = 'progress';
const DAYS = 'days';
const META = 'meta';
const SETTINGS_KEY = 'settings';
const OWNER_KEY = 'owner';

/** Records saved before sync existed carry no timestamp; they lose to any synced copy. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

export interface StoredSettings {
  value: Settings;
  updated_at: string;
}

export interface Snapshot {
  settings: StoredSettings | null;
  progress: Progress[];
  days: DayCount[];
}

export const isNewer = (a: string, b: string) => Date.parse(a) > Date.parse(b);

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(PROGRESS, { keyPath: 'item_id' });
      db.createObjectStore(DAYS, { keyPath: 'day' });
      db.createObjectStore(META, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let persistRequested = false;

/** Ask the browser not to evict study data under storage pressure; best effort. */
function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  void navigator.storage?.persist?.().catch(() => undefined);
}

const withTimestamp = (p: Progress): Progress => (p.updated_at ? p : { ...p, updated_at: EPOCH });

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readonly');
  const [progress, days, settings] = await Promise.all([
    result<Progress[]>(tx.objectStore(PROGRESS).getAll()),
    result<DayCount[]>(tx.objectStore(DAYS).getAll()),
    result<({ key: string } & StoredSettings) | undefined>(tx.objectStore(META).get(SETTINGS_KEY)),
  ]);
  return {
    progress: progress.map(withTimestamp),
    days,
    settings: settings ? { value: settings.value, updated_at: settings.updated_at ?? EPOCH } : null,
  };
}

export async function getProgress(itemId: string): Promise<Progress | undefined> {
  const db = await openDb();
  const p = await result<Progress | undefined>(db.transaction(PROGRESS).objectStore(PROGRESS).get(itemId));
  return p && withTimestamp(p);
}

/** Save one graded card and bump today's count in a single transaction. */
export async function saveReview(progress: Progress, day: string): Promise<void> {
  requestPersistence();
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS], 'readwrite');
  tx.objectStore(PROGRESS).put(progress);
  const days = tx.objectStore(DAYS);
  const current = await result<DayCount | undefined>(days.get(day));
  days.put({ day, count: (current?.count ?? 0) + 1 });
  await committed(tx);
}

export async function saveSettings(settings: Settings, updatedAt = new Date().toISOString()): Promise<void> {
  requestPersistence();
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put({ key: SETTINGS_KEY, value: settings, updated_at: updatedAt });
  await committed(tx);
}

/**
 * Fold a server copy into local data inside one transaction, so a card graded mid-sync is never
 * overwritten: progress and settings keep whichever side is newer, day counts keep the larger.
 * Returns whether anything local changed.
 */
export async function mergeRemote(remote: Snapshot): Promise<boolean> {
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readwrite');
  const progressStore = tx.objectStore(PROGRESS);
  const daysStore = tx.objectStore(DAYS);
  const metaStore = tx.objectStore(META);
  const [localProgress, localDays, localSettings] = await Promise.all([
    result<Progress[]>(progressStore.getAll()),
    result<DayCount[]>(daysStore.getAll()),
    result<({ key: string } & StoredSettings) | undefined>(metaStore.get(SETTINGS_KEY)),
  ]);

  let changed = false;
  const progressById = new Map(localProgress.map((p) => [p.item_id, withTimestamp(p)]));
  for (const p of remote.progress) {
    const local = progressById.get(p.item_id);
    if (!local || isNewer(p.updated_at, local.updated_at)) {
      progressStore.put(p);
      changed = true;
    }
  }
  const countByDay = new Map(localDays.map((d) => [d.day, d.count]));
  for (const d of remote.days) {
    if (d.count > (countByDay.get(d.day) ?? 0)) {
      daysStore.put(d);
      changed = true;
    }
  }
  if (remote.settings && (!localSettings || isNewer(remote.settings.updated_at, localSettings.updated_at ?? EPOCH))) {
    metaStore.put({ key: SETTINGS_KEY, ...remote.settings });
    changed = true;
  }
  await committed(tx);
  return changed;
}

/** Replace everything with a backup's contents. */
export async function replaceAll(snapshot: Snapshot): Promise<void> {
  requestPersistence();
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readwrite');
  const progress = tx.objectStore(PROGRESS);
  const days = tx.objectStore(DAYS);
  const meta = tx.objectStore(META);
  const owner = await result<{ key: string; value: string | null } | undefined>(meta.get(OWNER_KEY));
  progress.clear();
  days.clear();
  meta.clear();
  snapshot.progress.forEach((p) => progress.put(p));
  snapshot.days.forEach((d) => days.put(d));
  if (snapshot.settings) meta.put({ key: SETTINGS_KEY, ...snapshot.settings });
  if (owner) meta.put(owner);
  await committed(tx);
}

/** Remove progress for the given items, e.g. when one deck is reset. */
export async function deleteProgress(itemIds: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PROGRESS, 'readwrite');
  const store = tx.objectStore(PROGRESS);
  itemIds.forEach((id) => store.delete(id));
  await committed(tx);
}

/** Remove all progress and daily counts but keep settings and account ownership. */
export async function clearStudyData(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS], 'readwrite');
  tx.objectStore(PROGRESS).clear();
  tx.objectStore(DAYS).clear();
  await committed(tx);
}

/** Forget all local study data, including which account it belonged to. */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readwrite');
  tx.objectStore(PROGRESS).clear();
  tx.objectStore(DAYS).clear();
  tx.objectStore(META).clear();
  await committed(tx);
}

/** The account local data belongs to; null while it is a guest's. */
export async function getOwner(): Promise<string | null> {
  const db = await openDb();
  const row = await result<{ key: string; value: string | null } | undefined>(
    db.transaction(META).objectStore(META).get(OWNER_KEY),
  );
  return row?.value ?? null;
}

export async function setOwner(userId: string | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put({ key: OWNER_KEY, value: userId });
  await committed(tx);
}
