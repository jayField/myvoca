import pytest
from fastapi.testclient import TestClient

from app.main import app

H = {"X-Device-Id": "test-device-0001", "X-Local-Date": "2026-10-21"}


def on(day: str) -> dict:
    return {**H, "X-Local-Date": day}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MYVOCA_DB", str(tmp_path / "test.db"))
    with TestClient(app) as c:
        yield c


def learn(client, items, grade="good", headers=H):
    for item in items:
        res = client.post("/api/review", headers=headers, json={"item_id": item["id"], "grade": grade})
        assert res.status_code == 200


def test_requires_device_id(client):
    assert client.get("/api/today").status_code == 422
    assert client.get("/api/today", headers={"X-Device-Id": "bad id!"}).status_code == 400


def test_new_items_do_not_repeat_and_come_back_as_reviews(client):
    plan = client.get("/api/today", headers=H).json()
    assert plan["reviews"] == []
    assert [i["term"] for i in plan["new_items"]][:3] == ["あ", "い", "う"]
    assert len(plan["new_items"]) == 10

    learn(client, plan["new_items"])
    plan = client.get("/api/today", headers=H).json()
    assert plan["new_items"] == []
    assert plan["new_done"] == 10

    tomorrow = client.get("/api/today", headers=on("2026-10-22")).json()
    assert len(tomorrow["reviews"]) == 10
    assert tomorrow["new_items"][0]["term"] == "さ"


def test_random_order_is_stable_within_a_day(client):
    client.put("/api/settings", headers=H, json={"deck_id": "n5", "daily_new": 5, "order": "random"})
    first = [i["id"] for i in client.get("/api/today", headers=H).json()["new_items"]]
    second = [i["id"] for i in client.get("/api/today", headers=H).json()["new_items"]]
    assert first == second
    assert len(first) == 5


def test_deck_completion_returns_only_what_is_left(client):
    client.put("/api/settings", headers=H, json={"deck_id": "hiragana", "daily_new": 100, "order": "sequential"})
    plan = client.get("/api/today", headers=H).json()
    assert len(plan["new_items"]) == 46
    learn(client, plan["new_items"])
    plan = client.get("/api/today", headers=on("2026-10-22")).json()
    assert plan["new_items"] == []
    assert plan["deck_unlearned"] == 0


def test_settings_validation(client):
    bad_deck = {"deck_id": "nope", "daily_new": 10, "order": "random"}
    assert client.put("/api/settings", headers=H, json=bad_deck).status_code == 404
    bad_count = {"deck_id": "n5", "daily_new": 0, "order": "random"}
    assert client.put("/api/settings", headers=H, json=bad_count).status_code == 422


def test_confusing_collects_again_and_hard(client):
    items = client.get("/api/today", headers=H).json()["new_items"]
    learn(client, items[:2], grade="again")
    learn(client, items[2:3], grade="hard")
    learn(client, items[3:], grade="good")
    assert client.get("/api/decks", headers=H).json()["confusing"] == 3
    detail = client.get("/api/decks/confusing/items", headers=H).json()
    assert len(detail["items"]) == 3


def test_quiz_has_four_choices_including_answer(client):
    quiz = client.get("/api/quiz?deck_id=n5&count=5", headers=H).json()
    assert quiz["source"] == "all"
    assert len(quiz["questions"]) == 5
    for q in quiz["questions"]:
        ids = [c["id"] for c in q["choices"]]
        assert len(set(ids)) == 4
        assert q["item"]["id"] in ids


def test_streak_counts_consecutive_days(client):
    items = client.get("/api/today", headers=H).json()["new_items"]
    for day, item in zip(["2026-10-19", "2026-10-20", "2026-10-21"], items):
        learn(client, [item], headers=on(day))
    stats = client.get("/api/stats", headers=H).json()
    assert stats["streak"] == 3
    assert stats["learned"] == 3
    assert stats["heatmap"][-1] == {"date": "2026-10-21", "count": 1}
    assert len(stats["heatmap"]) == 140
