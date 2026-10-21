# ことば帳 (myvoca)

가나부터 JLPT N3까지, 매일 정한 만큼 익히고 잊을 때쯤 복습하는 일본어 단어 학습 웹앱.

- `frontend/` — React + Vite + TypeScript
- `backend/` — FastAPI + SQLite

## 실행

터미널 두 개에서 각각 실행한다.

```bash
# 1) 백엔드 (http://127.0.0.1:8000)
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 2) 프론트엔드 (http://localhost:5173)
cd frontend
npm install
npm run dev
```

프론트 개발 서버가 `/api` 요청을 백엔드로 넘겨준다 (`frontend/vite.config.ts`).

## 테스트

```bash
cd backend && uv run pytest
cd frontend && npm run build   # 타입 검사 포함
```

## 구조 메모

- **로그인 없음 (MVP)**: 브라우저가 처음 열릴 때 익명 기기 ID를 만들어 `localStorage`에 두고, 모든 요청에 `X-Device-Id`로 보낸다. 진도는 서버 SQLite(`backend/myvoca.db`)에 기기 ID별로 저장된다. 브라우저 저장소를 지우면 다른 사람으로 인식된다.
- **날짜 기준**: 하루 경계는 브라우저의 현지 날짜(`X-Local-Date`)를 따른다.
- **오늘의 학습**: 오늘 복습일이 된 카드 → 오늘의 새 항목 순서. 새 항목은 아직 시작하지 않은 항목에서만 뽑으므로 날마다 겹치지 않는다. 랜덤 모드는 기기·날짜로 시드를 고정해 새로고침해도 같은 묶음이 나온다.
- **SRS**: `backend/app/srs.py`. 몰랐음 → 내일 다시, 헷갈림 → 간격 ×1.2, 알았음 → 1일 → 3일 → 간격 × ease. 세션 중 몰랐음 카드는 끝에 한 번 더 나온다.
- **단어 데이터**: `backend/app/data/`. 서버 시작 시 `decks.json`에 적힌 파일을 (단어장, 단어) 기준으로 upsert하므로 단어를 추가해도 기존 진도가 유지된다. N5는 출처 결정 전까지 쓰는 직접 작성 샘플 80개다.
- **발음**: 브라우저 내장 TTS(Web Speech API). 일본어 음성이 없는 기기에서는 기본 음성으로 읽힌다.
