# 単語ノート (tango-note)

https://tango-note.pages.dev — 가나부터 JLPT N3까지, 매일 정한 만큼 익히고 잊을 때쯤 복습하는 일본어 단어 학습 웹앱.

서버 없이 브라우저만으로 동작하는 정적 사이트다 (React + Vite + TypeScript). 학습 기록은 각자 브라우저의 IndexedDB에 저장된다.

## 실행

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # 학습 로직·저장 테스트
npm run build   # 타입 검사 + dist/ 생성
```

## 배포 (Cloudflare Pages)

GitHub 저장소를 Cloudflare Pages(`tango-note`)에 연결해 main에 push하면 자동 배포된다.

| 항목 | 값 |
|---|---|
| Build command | `npm run build` (루트 `package.json`이 `frontend/`를 빌드) |
| Build output directory | `frontend/dist` |
| 환경 변수 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (빌드 시 주입되므로 바꾼 뒤 다시 배포) |

`404.html`이 없으면 Pages가 모든 경로를 `index.html`로 돌려주므로 `/decks/n5` 같은 주소를 새로고침해도 동작한다. 루트의 `wrangler.jsonc`는 Workers로 배포할 때만 쓰인다.

## 로그인·동기화 (Supabase)

사이트에 들어오면 로그인 화면부터 나오고, 로그인해야 앱을 쓸 수 있다. 가입은 아이디 + 비밀번호로 하며 이메일 인증은 없다. Supabase는 이메일로만 가입을 받으므로 아이디 `dalbi`는 `dalbi@tango-note.invalid`로 저장한다(`.invalid`는 메일이 갈 수 없는 주소). 학습 기록은 계정에 저장되고 같은 계정의 기기끼리 맞춰진다. Supabase 키가 없는 빌드는 로그인 없이 이 브라우저에만 저장하며 동작한다.

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 (Region: Northeast Asia (Seoul))
2. SQL Editor에서 `supabase/schema.sql` 실행 — 테이블 3개와 본인 행만 읽고 쓰게 하는 RLS 정책
3. Authentication → Sign In / Providers에서 Confirm email 끄기, URL Configuration의 Site URL에 배포 주소 입력
4. Project Settings → API에서 URL과 anon(publishable) 키를 복사해
   - 로컬: `frontend/.env.local` (`.env.example` 참고)
   - Cloudflare: 프로젝트 Settings → 빌드 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가 후 다시 배포

동기화 규칙: 카드·설정은 마지막으로 바뀐 쪽(`updated_at`)이 이기고, 하루 학습량은 큰 값을 남긴다. 로그아웃하면 이 기기의 기록을 지운다(다시 로그인하면 계정에서 불러옴).

## 구조 메모

- `src/api.ts` — 화면이 쓰는 데이터 계층. 아래 모듈을 묶는다.
- `src/lib/logic.ts` — 오늘의 학습, 단어장 요약, 퀴즈, 통계. 저장소와 분리된 순수 함수.
- `src/lib/srs.ts` — 간격 반복. 몰랐음 → 내일 다시, 헷갈림 → 간격 ×1.2, 알았음 → 1일 → 3일 → 간격 × ease. 세션 중 몰랐음 카드는 끝에 한 번 더 나온다.
- `src/lib/storage.ts` — IndexedDB (`progress`, `days`, `meta`).
- `src/lib/sync.ts`, `src/auth.tsx` — Supabase 로그인 상태와 양방향 동기화.
- `src/data/` — 단어 데이터. 항목 ID는 `단어장:단어`라서 목록 순서를 바꾸거나 단어를 추가해도 기존 기록이 유지된다. JLPT N5(412)·N4(264)·N3(213)는 공개 목록을 옮기지 않고 자주 쓰는 단어를 직접 골라 한국어 뜻을 단 것이다. 공식 어휘 목록은 2010년 이후 공개되지 않아 레벨 구분은 일반적인 학습 자료 기준이다.
- **오늘의 학습**: 오늘 복습일이 된 카드 → 오늘의 새 항목 순서. 새 항목은 아직 시작하지 않은 항목에서만 뽑아 날마다 겹치지 않는다. 랜덤 모드는 날짜로 시드를 고정해 새로고침해도 같은 묶음이 나온다.
- **백업**: 기록 화면에서 JSON 파일로 내보내기/가져오기.
- **발음**: `frontend/public/audio/`의 VOICEVOX(No.7 アナウンス, 0.75배속) 녹음을 재생하고, 녹음이 없는 단어는 브라우저 내장 TTS(여자 목소리 우선)로 읽는다. 단어를 추가하면 VOICEVOX 엔진을 띄우고 `node scripts/generate-audio.mjs --speaker 30 --speed 0.75 --credit "VOICEVOX:No.7"`(frontend에서)을 다시 실행한다 — 새 단어만 만든다. 크레딧 표기는 계정·로그인 화면에 있다.

## backend/ (현재 미사용)

처음에 만든 FastAPI + SQLite 버전이다. 로그인·기기 간 동기화가 필요해지면 다시 연결할 수 있도록 남겨 두었다. 실행: `cd backend && uv sync && uv run uvicorn app.main:app --port 8000`.
