// SM-2 style spaced repetition with three grades: 몰랐음(again) / 헷갈림(hard) / 알았음(good).
import type { Grade } from '../types';

export const MIN_EASE = 1.3;
export const MASTERED_INTERVAL = 21;

export interface CardState {
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
}

export const NEW_CARD: CardState = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };

export function schedule(state: CardState, grade: Grade): CardState {
  if (grade === 'again') {
    return {
      ease: Math.max(MIN_EASE, state.ease - 0.2),
      interval_days: 1,
      reps: 0,
      lapses: state.lapses + (state.reps > 0 ? 1 : 0),
    };
  }
  if (grade === 'hard') {
    return {
      ease: Math.max(MIN_EASE, state.ease - 0.15),
      interval_days: Math.max(1, Math.round(state.interval_days * 1.2)),
      reps: state.reps + 1,
      lapses: state.lapses,
    };
  }
  let interval: number;
  if (state.reps === 0) interval = 1;
  else if (state.reps === 1) interval = 3;
  else interval = Math.max(state.interval_days + 1, Math.round(state.interval_days * state.ease));
  return { ease: state.ease, interval_days: interval, reps: state.reps + 1, lapses: state.lapses };
}
