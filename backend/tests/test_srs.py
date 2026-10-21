from datetime import date

from app.srs import CardState, schedule

TODAY = date(2026, 10, 21)


def test_good_grows_interval():
    state = CardState()
    intervals = []
    for _ in range(3):
        state, _ = schedule(state, "good", TODAY)
        intervals.append(state.interval_days)
    assert intervals == [1, 3, 8]


def test_again_resets_and_lowers_ease():
    state = CardState(ease=2.5, interval_days=8, reps=3)
    state, due = schedule(state, "again", TODAY)
    assert state.reps == 0
    assert state.interval_days == 1
    assert state.lapses == 1
    assert state.ease < 2.5
    assert due == date(2026, 10, 22)


def test_ease_has_floor():
    state = CardState(ease=1.3)
    state, _ = schedule(state, "again", TODAY)
    assert state.ease == 1.3
