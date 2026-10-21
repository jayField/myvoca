import type { Stats } from '../api';

function level(count: number): number {
  if (count === 0) return 0;
  if (count < 5) return 1;
  if (count < 10) return 2;
  if (count < 20) return 3;
  return 4;
}

export function Heatmap({ days }: { days: Stats['heatmap'] }) {
  // Pad the front so each column is one Sunday-to-Saturday week.
  const firstWeekday = days.length ? new Date(`${days[0].date}T00:00:00`).getDay() : 0;
  return (
    <div className="heatmap-scroll">
      <div className="heatmap" role="img" aria-label={`최근 ${days.length}일 학습 기록`}>
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <span key={d.date} className={`heat heat-${level(d.count)}`} title={`${d.date} · ${d.count}개`} />
        ))}
      </div>
    </div>
  );
}
