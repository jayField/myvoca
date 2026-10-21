// The app's data layer. Everything runs in the browser: bundled word lists plus progress in IndexedDB.
import { CONFUSING_DECK, DECK_BY_ID } from './lib/content';
import { localDate } from './lib/dates';
import {
  applyReview,
  buildQuiz,
  computeStats,
  deckItems,
  deckSummaries,
  DEFAULT_SETTINGS,
  planToday,
  wordOfDay,
} from './lib/logic';
import * as storage from './lib/storage';
import type { DayCount, Grade, Progress, Settings } from './types';

export type * from './types';

export const CONFUSING_DECK_ID = CONFUSING_DECK.id;
export const LOAD_ERROR = '학습 기록을 불러오지 못했어요. 브라우저 저장소가 막혀 있지 않은지 확인해 주세요.';

const GRADE_SET = new Set<Grade>(['again', 'hard', 'good']);
const BACKUP_APP = 'tango-note';
const BACKUP_VERSION = 1;

function validSettings(s: Settings): Settings {
  if (!DECK_BY_ID.has(s.deck_id)) throw new Error('단어장을 찾을 수 없어요.');
  const daily_new = Math.max(1, Math.min(100, Math.round(s.daily_new)));
  return { deck_id: s.deck_id, daily_new, order: s.order === 'random' ? 'random' : 'sequential' };
}

function isProgress(p: unknown): p is Progress {
  const r = p as Record<string, unknown>;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.item_id === 'string' &&
    typeof r.ease === 'number' &&
    typeof r.interval_days === 'number' &&
    typeof r.reps === 'number' &&
    typeof r.lapses === 'number' &&
    typeof r.due === 'string' &&
    typeof r.first_seen === 'string' &&
    GRADE_SET.has(r.last_grade as Grade)
  );
}

function isDayCount(d: unknown): d is DayCount {
  const r = d as Record<string, unknown>;
  return typeof r === 'object' && r !== null && typeof r.day === 'string' && typeof r.count === 'number';
}

async function snapshot() {
  const s = await storage.loadSnapshot();
  return { ...s, settings: s.settings ?? DEFAULT_SETTINGS };
}

export const api = {
  async decks() {
    const { progress } = await snapshot();
    return deckSummaries(progress, localDate());
  },

  async deckItems(deckId: string) {
    const { progress } = await snapshot();
    return deckItems(deckId, progress, localDate());
  },

  async settings() {
    return (await snapshot()).settings;
  },

  async saveSettings(settings: Settings) {
    const clean = validSettings(settings);
    await storage.saveSettings(clean);
    return clean;
  },

  async today() {
    const today = localDate();
    const { settings, progress, days } = await snapshot();
    const reviewedToday = days.find((d) => d.day === today)?.count ?? 0;
    return planToday(settings, progress, reviewedToday, today);
  },

  async review(itemId: string, grade: Grade) {
    const today = localDate();
    const next = applyReview(await storage.getProgress(itemId), itemId, grade, today);
    await storage.saveReview(next, today);
    return next;
  },

  async stats() {
    const { progress, days } = await snapshot();
    return computeStats(progress, days, localDate());
  },

  async quiz(deckId: string, count = 10) {
    const { progress } = await snapshot();
    return buildQuiz(deckId, count, progress);
  },

  async wordOfDay() {
    return wordOfDay(localDate());
  },

  async exportBackup(): Promise<Blob> {
    const data = await storage.loadSnapshot();
    const backup = { app: BACKUP_APP, version: BACKUP_VERSION, exported_at: new Date().toISOString(), ...data };
    return new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  },

  /** Replaces all saved progress with the backup's; returns how many items it held. */
  async importBackup(text: string): Promise<number> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('백업 파일을 읽을 수 없어요.');
    }
    if (data?.app !== BACKUP_APP || data.version !== BACKUP_VERSION) throw new Error('단어 노트 백업 파일이 아니에요.');
    const { progress, days, settings } = data;
    if (!Array.isArray(progress) || !progress.every(isProgress) || !Array.isArray(days) || !days.every(isDayCount)) {
      throw new Error('백업 파일 내용이 올바르지 않아요.');
    }
    let cleanSettings: Settings | null = null;
    if (settings) {
      try {
        cleanSettings = validSettings(settings as Settings);
      } catch {
        // Keep the default if the backup points at a deck that no longer exists.
      }
    }
    await storage.replaceAll({ progress, days, settings: cleanSettings });
    return progress.length;
  },
};
