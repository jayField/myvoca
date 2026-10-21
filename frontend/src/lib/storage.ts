// IndexedDB persistence: one object store each for progress, per-day counts and settings.
import type { DayCount, Progress, Settings } from '../types';

const DB_NAME = 'tango-note';
const DB_VERSION = 1;
const PROGRESS = 'progress';
const DAYS = 'days';
const META = 'meta';
const SETTINGS_KEY = 'settings';

export interface Snapshot {
  settings: Settings | null;
  progress: Progress[];
  days: DayCount[];
}

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

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readonly');
  const [progress, days, meta] = await Promise.all([
    result<Progress[]>(tx.objectStore(PROGRESS).getAll()),
    result<DayCount[]>(tx.objectStore(DAYS).getAll()),
    result<{ key: string; value: Settings } | undefined>(tx.objectStore(META).get(SETTINGS_KEY)),
  ]);
  return { progress, days, settings: meta?.value ?? null };
}

export async function getProgress(itemId: string): Promise<Progress | undefined> {
  const db = await openDb();
  return result<Progress | undefined>(db.transaction(PROGRESS).objectStore(PROGRESS).get(itemId));
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

export async function saveSettings(settings: Settings): Promise<void> {
  requestPersistence();
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put({ key: SETTINGS_KEY, value: settings });
  await committed(tx);
}

/** Replace everything with a backup's contents. */
export async function replaceAll(snapshot: Snapshot): Promise<void> {
  requestPersistence();
  const db = await openDb();
  const tx = db.transaction([PROGRESS, DAYS, META], 'readwrite');
  const progress = tx.objectStore(PROGRESS);
  const days = tx.objectStore(DAYS);
  const meta = tx.objectStore(META);
  progress.clear();
  days.clear();
  meta.clear();
  snapshot.progress.forEach((p) => progress.put(p));
  snapshot.days.forEach((d) => days.put(d));
  if (snapshot.settings) meta.put({ key: SETTINGS_KEY, value: snapshot.settings });
  await committed(tx);
}
