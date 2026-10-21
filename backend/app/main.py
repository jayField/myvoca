import random
import re
import sqlite3
from collections.abc import Iterator
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from . import db
from .srs import MASTERED_INTERVAL, CardState, Grade, schedule

DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
CONFUSING_DECK = {"id": "confusing", "title": "헷갈리는 단어", "description": "몰랐음·헷갈림으로 표시한 단어"}
DEFAULT_DECK = "hiragana"
WORD_OF_DAY_DECK = "n5"
HEATMAP_DAYS = 140

ITEM_COLUMNS = "i.id, i.deck_id, d.kind, i.term, i.reading, i.meaning, i.example_ja, i.example_ko"
ITEM_FROM = "items i JOIN decks d ON d.id = i.deck_id"
PROGRESS_FROM = "progress p JOIN items i ON i.id = p.item_id JOIN decks d ON d.id = i.deck_id"


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="ことば帳 API", lifespan=lifespan)


def get_conn() -> Iterator[sqlite3.Connection]:
    conn = db.connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def device_id(x_device_id: str = Header()) -> str:
    if not DEVICE_ID_RE.match(x_device_id):
        raise HTTPException(400, "X-Device-Id 형식이 올바르지 않아요.")
    return x_device_id


def local_day(x_local_date: str | None = Header(default=None)) -> date:
    """The learner's calendar day comes from the browser so day boundaries follow their timezone."""
    if x_local_date:
        try:
            return date.fromisoformat(x_local_date)
        except ValueError:
            pass
    return date.today()


class Settings(BaseModel):
    deck_id: str
    daily_new: int = Field(ge=1, le=100)
    order: Literal["sequential", "random"]


class ReviewIn(BaseModel):
    item_id: int
    grade: Grade


def load_settings(conn: sqlite3.Connection, device: str) -> Settings:
    row = conn.execute(
        "SELECT deck_id, daily_new, order_mode FROM settings WHERE device_id = ?", (device,)
    ).fetchone()
    if row is None:
        return Settings(deck_id=DEFAULT_DECK, daily_new=10, order="sequential")
    return Settings(deck_id=row["deck_id"], daily_new=row["daily_new"], order=row["order_mode"])


def get_deck(conn: sqlite3.Connection, deck_id: str) -> dict:
    row = conn.execute("SELECT id, title, description, kind FROM decks WHERE id = ?", (deck_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "단어장을 찾을 수 없어요.")
    return dict(row)


def item_status(row: sqlite3.Row, today: date) -> str:
    if row["due"] is None:
        return "new"
    if row["due"] <= today.isoformat():
        return "due"
    return "mastered" if row["interval_days"] >= MASTERED_INTERVAL else "learning"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/decks")
def list_decks(
    device: str = Depends(device_id),
    today: date = Depends(local_day),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    rows = conn.execute(
        """
        SELECT d.id, d.title, d.description, d.kind,
               COUNT(i.id) AS total,
               COUNT(p.item_id) AS learned,
               SUM(CASE WHEN p.due <= ? THEN 1 ELSE 0 END) AS due
        FROM decks d
        JOIN items i ON i.deck_id = d.id
        LEFT JOIN progress p ON p.item_id = i.id AND p.device_id = ?
        GROUP BY d.id
        ORDER BY d.position
        """,
        (today.isoformat(), device),
    ).fetchall()
    confusing = conn.execute(
        "SELECT COUNT(*) FROM progress WHERE device_id = ? AND last_grade IN ('again', 'hard')", (device,)
    ).fetchone()[0]
    return {"decks": [dict(r) for r in rows], "confusing": confusing}


@app.get("/api/decks/{deck_id}/items")
def deck_items(
    deck_id: str,
    device: str = Depends(device_id),
    today: date = Depends(local_day),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    select = f"""
        SELECT {ITEM_COLUMNS}, p.due, p.interval_days, p.last_grade
        FROM {ITEM_FROM}
        LEFT JOIN progress p ON p.item_id = i.id AND p.device_id = ?
    """
    if deck_id == CONFUSING_DECK["id"]:
        deck = CONFUSING_DECK
        rows = conn.execute(
            select + " WHERE p.last_grade IN ('again', 'hard') ORDER BY d.position, i.position", (device,)
        ).fetchall()
    else:
        deck = get_deck(conn, deck_id)
        rows = conn.execute(select + " WHERE i.deck_id = ? ORDER BY i.position", (device, deck_id)).fetchall()
    items = [
        {k: row[k] for k in row.keys() if k != "interval_days"} | {"status": item_status(row, today)}
        for row in rows
    ]
    return {"deck": deck, "items": items}


@app.get("/api/settings")
def read_settings(device: str = Depends(device_id), conn: sqlite3.Connection = Depends(get_conn)) -> Settings:
    return load_settings(conn, device)


@app.put("/api/settings")
def write_settings(
    body: Settings, device: str = Depends(device_id), conn: sqlite3.Connection = Depends(get_conn)
) -> Settings:
    get_deck(conn, body.deck_id)
    conn.execute(
        """
        INSERT INTO settings (device_id, deck_id, daily_new, order_mode) VALUES (?, ?, ?, ?)
        ON CONFLICT (device_id) DO UPDATE SET
            deck_id = excluded.deck_id, daily_new = excluded.daily_new, order_mode = excluded.order_mode
        """,
        (device, body.deck_id, body.daily_new, body.order),
    )
    return body


@app.get("/api/today")
def today_plan(
    device: str = Depends(device_id),
    today: date = Depends(local_day),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    settings = load_settings(conn, device)
    deck = get_deck(conn, settings.deck_id)
    day = today.isoformat()

    reviews = conn.execute(
        f"""
        SELECT {ITEM_COLUMNS} FROM {PROGRESS_FROM}
        WHERE p.device_id = ? AND p.due <= ?
        ORDER BY p.due, d.position, i.position
        """,
        (device, day),
    ).fetchall()
    new_done = conn.execute(
        "SELECT COUNT(*) FROM progress WHERE device_id = ? AND first_seen = ?", (device, day)
    ).fetchone()[0]
    reviewed_today = conn.execute(
        "SELECT COUNT(*) FROM review_log WHERE device_id = ? AND day = ?", (device, day)
    ).fetchone()[0]

    # New items only ever come from what this device has not started, so days never overlap.
    unlearned = [
        dict(r)
        for r in conn.execute(
            f"""
            SELECT {ITEM_COLUMNS} FROM {ITEM_FROM}
            WHERE i.deck_id = ?
              AND NOT EXISTS (SELECT 1 FROM progress p WHERE p.device_id = ? AND p.item_id = i.id)
            ORDER BY i.position
            """,
            (settings.deck_id, device),
        ).fetchall()
    ]
    if settings.order == "random":
        # Seeded per device and day so reloading the page does not reshuffle today's picks.
        random.Random(f"{device}:{day}").shuffle(unlearned)
    remaining = max(0, settings.daily_new - new_done)

    return {
        "date": day,
        "settings": settings,
        "deck_title": deck["title"],
        "reviews": [dict(r) for r in reviews],
        "new_items": unlearned[:remaining],
        "new_done": new_done,
        "deck_unlearned": len(unlearned),
        "reviewed_today": reviewed_today,
    }


@app.post("/api/review")
def review(
    body: ReviewIn,
    device: str = Depends(device_id),
    today: date = Depends(local_day),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    if conn.execute("SELECT 1 FROM items WHERE id = ?", (body.item_id,)).fetchone() is None:
        raise HTTPException(404, "항목을 찾을 수 없어요.")
    row = conn.execute(
        "SELECT ease, interval_days, reps, lapses FROM progress WHERE device_id = ? AND item_id = ?",
        (device, body.item_id),
    ).fetchone()
    state = CardState(**dict(row)) if row else CardState()
    new, due = schedule(state, body.grade, today)
    conn.execute(
        """
        INSERT INTO progress (device_id, item_id, ease, interval_days, reps, lapses, due, first_seen, last_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (device_id, item_id) DO UPDATE SET
            ease = excluded.ease, interval_days = excluded.interval_days, reps = excluded.reps,
            lapses = excluded.lapses, due = excluded.due, last_grade = excluded.last_grade
        """,
        (device, body.item_id, new.ease, new.interval_days, new.reps, new.lapses,
         due.isoformat(), today.isoformat(), body.grade),
    )
    conn.execute(
        "INSERT INTO review_log (device_id, item_id, grade, day) VALUES (?, ?, ?, ?)",
        (device, body.item_id, body.grade, today.isoformat()),
    )
    return {"item_id": body.item_id, "due": due.isoformat(), "interval_days": new.interval_days}


@app.get("/api/stats")
def stats(
    device: str = Depends(device_id),
    today: date = Depends(local_day),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    counts = {
        r["day"]: r["n"]
        for r in conn.execute(
            "SELECT day, COUNT(*) AS n FROM review_log WHERE device_id = ? GROUP BY day", (device,)
        ).fetchall()
    }
    # A streak survives until the end of today, so an unstudied today still counts yesterday's run.
    streak = 0
    day = today if today.isoformat() in counts else today - timedelta(days=1)
    while day.isoformat() in counts:
        streak += 1
        day -= timedelta(days=1)

    start = today - timedelta(days=HEATMAP_DAYS - 1)
    heatmap = []
    for offset in range(HEATMAP_DAYS):
        key = (start + timedelta(days=offset)).isoformat()
        heatmap.append({"date": key, "count": counts.get(key, 0)})

    learned, mastered = conn.execute(
        "SELECT COUNT(*), SUM(CASE WHEN interval_days >= ? THEN 1 ELSE 0 END) FROM progress WHERE device_id = ?",
        (MASTERED_INTERVAL, device),
    ).fetchone()
    return {
        "streak": streak,
        "learned": learned,
        "mastered": mastered or 0,
        "reviews_today": counts.get(today.isoformat(), 0),
        "heatmap": heatmap,
    }


@app.get("/api/quiz")
def quiz(
    deck_id: str | None = None,
    count: int = Query(default=10, ge=1, le=30),
    device: str = Depends(device_id),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    deck_id = deck_id or load_settings(conn, device).deck_id
    learned_select = f"""
        SELECT {ITEM_COLUMNS} FROM {PROGRESS_FROM}
        WHERE p.device_id = ?
    """
    if deck_id == CONFUSING_DECK["id"]:
        pool = conn.execute(learned_select + " AND p.last_grade IN ('again', 'hard')", (device,)).fetchall()
        source = "confusing"
    else:
        get_deck(conn, deck_id)
        pool = conn.execute(learned_select + " AND i.deck_id = ?", (device, deck_id)).fetchall()
        source = "learned"
        if len(pool) < 4:
            pool = conn.execute(f"SELECT {ITEM_COLUMNS} FROM {ITEM_FROM} WHERE i.deck_id = ?", (deck_id,)).fetchall()
            source = "all"

    pool = [dict(r) for r in pool]
    distractors_by_deck: dict[str, list[dict]] = {}
    for deck in {item["deck_id"] for item in pool}:
        distractors_by_deck[deck] = [
            dict(r) for r in conn.execute(f"SELECT {ITEM_COLUMNS} FROM {ITEM_FROM} WHERE i.deck_id = ?", (deck,))
        ]

    rng = random.Random()
    questions = []
    for item in rng.sample(pool, min(count, len(pool))):
        others = [x for x in distractors_by_deck[item["deck_id"]] if x["meaning"] != item["meaning"]]
        choices = rng.sample(others, 3) + [item]
        rng.shuffle(choices)
        questions.append({"item": item, "choices": choices})
    return {"deck_id": deck_id, "source": source, "questions": questions}


@app.get("/api/word-of-day")
def word_of_day(today: date = Depends(local_day), conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    rows = conn.execute(
        f"SELECT {ITEM_COLUMNS} FROM {ITEM_FROM} WHERE i.deck_id = ? AND i.example_ja IS NOT NULL ORDER BY i.position",
        (WORD_OF_DAY_DECK,),
    ).fetchall()
    return dict(rows[today.toordinal() % len(rows)])
