# Lib Quest

2026 도서관 데이터 활용 공모전 발표심사용 모바일 웹 프로토타입.
도서관 실제 소장 도서를 기반으로 서가를 탐색하고 ISBN을 확인하며 퀘스트를 완료하는 서비스.

대표 도서관: 청주가로수도서관 (libCode 143136)

## 현재 상태 (이번 단계 완료 범위)

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 초기화
- Prisma 7 + PostgreSQL(Neon) 연결 구조 추가 (`@prisma/adapter-pg` 드라이버 어댑터 방식)
- 데이터 모델 초안 작성: `Library`, `Book`, `Quest`, `QuestStep`, `QuestCandidate`, `QuestSession` ([prisma/schema.prisma](prisma/schema.prisma))
- 시드 스크립트 작성: 청주가로수도서관 + 도서 32권 + 퀘스트 3개(그중 "한국 소설 탐험"은 3단계 모두 구성) ([prisma/seed.ts](prisma/seed.ts))
- 모바일 우선 레이아웃, 최소 PWA manifest ([src/app/layout.tsx](src/app/layout.tsx), [public/manifest.json](public/manifest.json))
- 라우트: `/`, `/quests`, `/quests/[id]`
- **퀘스트 1개("한국 소설 탐험")를 임시(mock) 데이터로 처음부터 끝까지 진행 가능**
  - 퀘스트 선택 → 미션 확인 → 서가 안내 확인 → ISBN 확인(수동 입력 + 카메라 스캔 최소 구현) → 성공/실패 판정 → 다음 단계 해금 → 최종 결과 카드
  - ISBN 판정은 전부 규칙 기반(정확 일치 비교)이며 AI가 정답 여부를 판단하지 않음
  - "다른 책 보기"로 같은 단계의 다른 후보 도서 확인 가능
  - 익명 세션은 `localStorage` 기반으로 진행 상태를 유지 (새로고침/재방문 시 이어짐)

이번 단계에서는 실제 Prisma 조회 대신 [src/lib/mock-data.ts](src/lib/mock-data.ts)의 임시 데이터로 화면 흐름만 검증했다. DB 연결 후에는 이 모듈을 Prisma 조회로 교체하면 된다.

## 실행 방법

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속. 모바일 폭(375px 등)에서 확인 권장.

### Prisma / DB (선택, 아직 미연결 상태로도 위 데모는 동작함)

```bash
# .env에 DATABASE_URL 설정 후
npx prisma migrate dev --name init
npm run db:seed
npm run db:studio
```

## 필요한 환경 변수

`.env.example` 참고.

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 (pooled) |

## 아직 미구현인 항목

- 실제 Prisma 데이터 조회로 `/quests`, `/quests/[id]` 연결 (현재는 mock 데이터)
- 퀘스트 2, 3("세계 고전 산책", "마음을 다독이는 책")의 단계/후보 화면 연결 (시드에는 있으나 화면용 mock에는 미반영, 목록에 "준비 중"으로 표시됨)
- ISBN 검증 API 라우트(서버 판정)로 전환 — 현재는 클라이언트에서 mock 데이터 기준 판정
- 카메라 바코드 스캔 고도화 (현재는 브라우저 내장 `BarcodeDetector` API만 사용, 미지원 브라우저는 수동 입력만 안내)
- 최소 운영자 검수 화면
- 데이터 출처 확인 화면
- 실제 도서관 정보나루 API 연동 및 시드 데이터 최신화

## 다음 작업 (제안)

1. `/api/quests`, `/api/quests/[id]`, `/api/verify` 등 API 라우트를 추가해 Prisma로 실제 데이터 조회 및 서버 측 ISBN 판정으로 전환
2. `QuestSession`을 서버에 실제로 생성/갱신하도록 연결 (현재 localStorage는 임시 방편)
3. 최소 운영자 검수 화면 + 데이터 출처 확인 화면 추가

## 기술 스택

Next.js · React · TypeScript · App Router · Tailwind CSS · PostgreSQL · Prisma · Neon · Vercel
