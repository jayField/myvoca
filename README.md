# 単語ノート (tango-note)

https://tango-note.nariyo1324.workers.dev — 가나부터 JLPT N3까지, 매일 정한 만큼 익히고 잊을 때쯤 복습하는 일본어 단어 학습 웹앱.

서버 없이 브라우저만으로 동작하는 정적 사이트다 (React + Vite + TypeScript). 학습 기록은 각자 브라우저의 IndexedDB에 저장된다.

## 실행

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # 학습 로직·저장 테스트
npm run build   # 타입 검사 + dist/ 생성
```

## 배포 (Cloudflare Workers)

GitHub 저장소를 Cloudflare Workers에 연결한다 (Create application → Import a repository). 저장소 루트의 `package.json`이 `frontend/`를 빌드하고, `wrangler.jsonc`가 `frontend/dist`를 정적 자산으로 올린다.

| 항목 | 값 |
|---|---|
| Project name | `tango-note` (`wrangler.jsonc`의 `name`과 같아야 함) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Path (Root directory) | 비워 둠 (저장소 루트) |

`not_found_handling: single-page-application` 덕분에 `/decks/n5` 같은 주소를 새로고침해도 동작한다.

## 구조 메모

- `src/api.ts` — 화면이 쓰는 데이터 계층. 아래 모듈을 묶는다.
- `src/lib/logic.ts` — 오늘의 학습, 단어장 요약, 퀴즈, 통계. 저장소와 분리된 순수 함수.
- `src/lib/srs.ts` — 간격 반복. 몰랐음 → 내일 다시, 헷갈림 → 간격 ×1.2, 알았음 → 1일 → 3일 → 간격 × ease. 세션 중 몰랐음 카드는 끝에 한 번 더 나온다.
- `src/lib/storage.ts` — IndexedDB (`progress`, `days`, `meta`).
- `src/data/` — 단어 데이터. 항목 ID는 `단어장:단어`라서 목록 순서를 바꾸거나 단어를 추가해도 기존 기록이 유지된다. N5는 출처 결정 전까지 쓰는 직접 작성 샘플 80개다.
- **오늘의 학습**: 오늘 복습일이 된 카드 → 오늘의 새 항목 순서. 새 항목은 아직 시작하지 않은 항목에서만 뽑아 날마다 겹치지 않는다. 랜덤 모드는 날짜로 시드를 고정해 새로고침해도 같은 묶음이 나온다.
- **백업**: 기록 화면에서 JSON 파일로 내보내기/가져오기. 기기 간 동기화는 없다.
- **발음**: 브라우저 내장 TTS(Web Speech API).

## backend/ (현재 미사용)

처음에 만든 FastAPI + SQLite 버전이다. 로그인·기기 간 동기화가 필요해지면 다시 연결할 수 있도록 남겨 두었다. 실행: `cd backend && uv sync && uv run uvicorn app.main:app --port 8000`.
