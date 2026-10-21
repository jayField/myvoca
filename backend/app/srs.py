"""SM-2 style spaced repetition with three grades: 몰랐음(again) / 헷갈림(hard) / 알았음(good)."""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

Grade = Literal["again", "hard", "good"]

MIN_EASE = 1.3
MASTERED_INTERVAL = 21


@dataclass(frozen=True)
class CardState:
    ease: float = 2.5
    interval_days: int = 0
    reps: int = 0
    lapses: int = 0


def schedule(state: CardState, grade: Grade, today: date) -> tuple[CardState, date]:
    if grade == "again":
        lapses = state.lapses + (1 if state.reps > 0 else 0)
        new = CardState(max(MIN_EASE, state.ease - 0.2), 1, 0, lapses)
    elif grade == "hard":
        interval = max(1, round(state.interval_days * 1.2))
        new = CardState(max(MIN_EASE, state.ease - 0.15), interval, state.reps + 1, state.lapses)
    else:
        if state.reps == 0:
            interval = 1
        elif state.reps == 1:
            interval = 3
        else:
            interval = max(state.interval_days + 1, round(state.interval_days * state.ease))
        new = CardState(state.ease, interval, state.reps + 1, state.lapses)
    return new, today + timedelta(days=new.interval_days)
