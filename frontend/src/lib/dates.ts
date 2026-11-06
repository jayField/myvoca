const pad = (n: number) => String(n).padStart(2, '0');

/** The learner's local calendar day as YYYY-MM-DD; all day boundaries follow it. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days since the Unix epoch, for picking something per calendar day. */
export function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** A day as a heading, e.g. 2026년 11월 6일 (금) (오늘); compact leaves out the year and month. */
export function dayLabel(day: string, compact = false): string {
  if (!day) return '날짜 없음';
  const today = localDate();
  const label = new Date(`${day}T00:00:00`).toLocaleDateString(
    'ko-KR',
    compact ? { day: 'numeric', weekday: 'short' } : { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
  );
  if (day === today) return `${label} (오늘)`;
  if (day === addDays(today, -1)) return `${label} (어제)`;
  return label;
}
