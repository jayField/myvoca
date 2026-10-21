import json
import os
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DEFAULT_DB = Path(__file__).resolve().parent.parent / "myvoca.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    position INTEGER NOT NULL,
    term TEXT NOT NULL,
    reading TEXT NOT NULL,
    meaning TEXT NOT NULL,
    example_ja TEXT,
    example_ko TEXT,
    UNIQUE (deck_id, term)
);
CREATE TABLE IF NOT EXISTS progress (
    device_id TEXT NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id),
    ease REAL NOT NULL,
    interval_days INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    due TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    last_grade TEXT NOT NULL,
    PRIMARY KEY (device_id, item_id)
);
CREATE TABLE IF NOT EXISTS review_log (
    id INTEGER PRIMARY KEY,
    device_id TEXT NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id),
    grade TEXT NOT NULL,
    day TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    device_id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    daily_new INTEGER NOT NULL,
    order_mode TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_log_device_day ON review_log (device_id, day);
"""


def db_path() -> Path:
    return Path(os.environ.get("MYVOCA_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    # FastAPI runs sync dependencies and endpoints on different worker threads.
    conn = sqlite3.connect(db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        seed(conn)
        conn.commit()
    finally:
        conn.close()


def seed(conn: sqlite3.Connection) -> None:
    """Upsert bundled decks by (deck_id, term) so item ids, and progress tied to them, survive reseeding."""
    decks = json.loads((DATA_DIR / "decks.json").read_text(encoding="utf-8"))
    for position, deck in enumerate(decks):
        conn.execute(
            """
            INSERT INTO decks (id, title, description, kind, position) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                title = excluded.title, description = excluded.description,
                kind = excluded.kind, position = excluded.position
            """,
            (deck["id"], deck["title"], deck["description"], deck["kind"], position),
        )
        items = json.loads((DATA_DIR / deck["file"]).read_text(encoding="utf-8"))
        for item_position, item in enumerate(items):
            conn.execute(
                """
                INSERT INTO items (deck_id, position, term, reading, meaning, example_ja, example_ko)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (deck_id, term) DO UPDATE SET
                    position = excluded.position, reading = excluded.reading, meaning = excluded.meaning,
                    example_ja = excluded.example_ja, example_ko = excluded.example_ko
                """,
                (
                    deck["id"],
                    item_position,
                    item["term"],
                    item["reading"],
                    item["meaning"],
                    item.get("example_ja"),
                    item.get("example_ko"),
                ),
            )
