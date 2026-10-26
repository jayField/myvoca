// Two-way sync between this browser's IndexedDB and the signed-in user's rows in Supabase.
import type { DayCount, OrderMode, Progress } from '../types';
import * as storage from './storage';
import { supabase } from './supabase';

const PROGRESS_COLUMNS = 'item_id, ease, interval_days, reps, lapses, due, first_seen, last_grade, missed_on, studied_on, study_grade, reset_on, updated_at';

let queue: Promise<unknown> = Promise.resolve();

/**
 * Run syncs and resets one at a time. A sync that read the server just before a reset deleted rows
 * would otherwise write those rows back here and push them up again, undoing the reset.
 */
export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

interface SettingsRow {
  deck_id: string;
  daily_new: number;
  order_mode: OrderMode;
  updated_at: string;
}

/**
 * Delete the signed-in account's progress on the server — for one deck (item ids are `deck:term`)
 * or everything, including daily counts. Without this a reset would be pulled back on the next sync.
 * Does nothing when signed out.
 */
export async function deleteRemoteStudyData(deckId?: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const progress = supabase.from('progress').delete();
  const res = await (deckId ? progress.like('item_id', `${deckId}:%`) : progress.like('item_id', '%'));
  if (res.error) throw res.error;
  if (!deckId) {
    const days = await supabase.from('day_counts').delete().gte('day', '1900-01-01');
    if (days.error) throw days.error;
  }
}

/**
 * Pull the account's rows, merge them into local data (newer wins), then push whatever is newer
 * locally. Returns whether local data changed, so screens know to reload.
 */
export function syncNow(userId: string): Promise<boolean> {
  return exclusive(() => syncOnce(userId));
}

async function syncOnce(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const [progressRes, daysRes, settingsRes] = await Promise.all([
    supabase.from('progress').select(PROGRESS_COLUMNS),
    supabase.from('day_counts').select('day, count'),
    supabase.from('user_settings').select('deck_id, daily_new, order_mode, updated_at').maybeSingle<SettingsRow>(),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (daysRes.error) throw daysRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const remoteProgress = progressRes.data as Progress[];
  const remoteDays = daysRes.data as DayCount[];
  const remoteSettings = settingsRes.data
    ? {
        value: {
          deck_id: settingsRes.data.deck_id,
          daily_new: settingsRes.data.daily_new,
          order: settingsRes.data.order_mode,
        },
        updated_at: settingsRes.data.updated_at,
      }
    : null;

  const changed = await storage.mergeRemote({ progress: remoteProgress, days: remoteDays, settings: remoteSettings });

  const local = await storage.loadSnapshot();
  const remoteUpdated = new Map(remoteProgress.map((p) => [p.item_id, p.updated_at]));
  const progressToPush = local.progress.filter((p) => {
    const theirs = remoteUpdated.get(p.item_id);
    return !theirs || storage.isNewer(p.updated_at, theirs);
  });
  const remoteCounts = new Map(remoteDays.map((d) => [d.day, d.count]));
  const daysToPush = local.days.filter((d) => d.count > (remoteCounts.get(d.day) ?? -1));
  const pushSettings =
    local.settings && (!remoteSettings || storage.isNewer(local.settings.updated_at, remoteSettings.updated_at));

  const writes = [];
  if (progressToPush.length) {
    writes.push(supabase.from('progress').upsert(progressToPush.map((p) => ({ ...p, user_id: userId }))));
  }
  if (daysToPush.length) {
    writes.push(supabase.from('day_counts').upsert(daysToPush.map((d) => ({ ...d, user_id: userId }))));
  }
  if (pushSettings && local.settings) {
    const { deck_id, daily_new, order } = local.settings.value;
    writes.push(
      supabase.from('user_settings').upsert({
        user_id: userId,
        deck_id,
        daily_new,
        order_mode: order,
        updated_at: local.settings.updated_at,
      }),
    );
  }
  for (const res of await Promise.all(writes)) {
    if (res.error) throw res.error;
  }
  return changed;
}
