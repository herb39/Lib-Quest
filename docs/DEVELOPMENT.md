# Lib Quest Development Guide

**대상: 개발자 / 시스템 관리자** (코드/DB/인프라를 유지보수하는 사람)

발표용 MVP의 기술 구조와 로컬 개발/데이터 수집/배포 절차를 정리한 개발자 문서. 이 문서에는 기술적인 정보만 둔다.

- 서비스 소개, 이용 방법: [README.md](../README.md)
- 사서/운영자를 위한 검수 안내: [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)
- 심사자/발표자를 위한 시연 시나리오: [DEMO_GUIDE.md](DEMO_GUIDE.md)

## 기술 스택

`package.json` 기준.

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4
- Prisma 7 + `@prisma/adapter-pg`(pg 드라이버 어댑터 방식) + PostgreSQL(Neon)
- `@zxing/browser` + `@zxing/library` — 모바일 카메라 ISBN 바코드 스캔
- 배포: Vercel (Hobby) + Cloudflare DNS(only) + Neon PostgreSQL(Free)

## 아키텍처

```
Data4Library (itemSrch)
  → scripts/fetch-library-books.ts (로컬 사전 수집, 원본 스냅샷 보존)
  → data/collected-books.json / data/quest-curation.json (사람이 검증·큐레이션)
  → prisma/seed.ts (Neon PostgreSQL에 반영)
  → Next.js (Vercel, 요청마다 Neon 조회)
  → 사용자
```

**production은 요청마다 Data4Library를 호출하지 않는다.** 도서 데이터는 로컬에서 미리 수집·검증한 뒤 Neon에 저장해 두고, 서비스는 항상 Neon만 조회한다. Data4Library API는 로컬 수집 스크립트를 실행할 때만 사용된다.

## 주요 데이터 모델

`prisma/schema.prisma` 기준.

- `Library` — 대표 도서관(단일). `code`(libCode), `name`
- `Book` — 실제 수집 도서. `isbn13`, `title`, `author`, `classNo`/`className`(KDC), `callNumber`, `shelfLocation`, `registeredAt`, `source`
- `Quest` — 퀘스트. `title`, `description`, `theme`, `estimatedMinutes`, `difficulty`, `published`
- `QuestStep` — 퀘스트 단계. `order`, `title`, `description`, `hint`
- `QuestCandidate` — 단계별 후보 도서 (`QuestStep` ↔ `Book`, `isPrimary`)
- `QuestSession` — 스키마에는 존재하지만 **현재 애플리케이션 코드에서 실제로 사용하지 않는다.** 진행 상태는 클라이언트 `localStorage`로 관리한다 (아래 "ISBN 검증 구조 / 세션 정책" 참고). 추후 서버 세션이 필요해지면 확장할 자리로 남겨둔 것.

## 프로젝트 구조

```
src/
  app/
    page.tsx                 # 홈
    quests/page.tsx          # 퀘스트 목록 (DB 조회)
    quests/[id]/page.tsx     # 퀘스트 상세 (DB 조회) + QuestRunner
    quests/error.tsx         # /quests 세그먼트 공용 에러 화면
    admin/review/page.tsx    # 운영자 검수 화면 (읽기 전용)
    data-source/page.tsx     # 데이터 출처 화면
    api/quests/[questId]/steps/[stepId]/verify/route.ts  # ISBN 서버 판정 API
  components/
    Header.tsx                 # 공통 헤더 (좌: Lib Quest 홈 링크, 우: 홈이 아닐 때만 "홈" 버튼)
    QuestRunner.tsx           # 퀘스트 진행 클라이언트 컴포넌트 (localStorage 세션)
    BarcodeScanner.tsx         # ZXing 기반 카메라 바코드 스캐너
    CopyIsbnButton.tsx          # /admin/review 전용 ISBN 클립보드 복사 버튼
  lib/
    config.ts                 # 대표 도서관 식별자(LIBRARY_CODE/LIBRARY_NAME)
    data.ts                   # /quests, /quests/[id]용 DB 조회 (DB 없으면 데모 데이터)
    admin-data.ts              # /admin/review, /data-source용 DB 조회 (데모 대체 없음)
    mock-data.ts               # 로컬 개발 전용 데모 데이터 (실데이터 아님)
    prisma.ts                  # Prisma Client 싱글턴 (adapter-pg)
    types.ts                   # 화면용 공용 타입
prisma/
  schema.prisma
  migrations/                 # 라이브 DB 연결 없이 `migrate diff`로 생성한 초기 마이그레이션 포함
  seed.ts                     # data/collected-books.json + data/quest-curation.json만 시드
scripts/
  lookup-library.ts           # Data4Library libSrch로 실제 libCode 조회
  fetch-library-books.ts      # Data4Library itemSrch로 실제 도서 수집
data/
  README.md                   # 수집 절차 상세
  snapshots/                  # itemSrch 원본 응답 (authKey 미포함)
  collected-books.json        # 정규화·큐레이션된 실제 도서 목록
  quest-curation.json         # 퀘스트/단계/후보 구성 (collected-books의 ISBN만 참조)
docs/
  DEVELOPMENT.md               # 이 문서 (개발자/시스템 관리자용)
  OPERATOR_GUIDE.md            # 사서/운영자용 검수 가이드
  DEMO_GUIDE.md                 # 심사자/발표자용 시연 시나리오
```

## 환경변수

`.env.example` 참고. 실제 값은 어떤 문서에도 적지 않는다.

| 변수 | 필요 시점 | 비고 |
| --- | --- | --- |
| `DATABASE_URL` | 로컬 DB 연결 시 / Vercel 운영 | Neon PostgreSQL 연결 문자열. 비어 있으면 `src/lib/data.ts`가 데모 데이터로 자동 대체 |
| `DATA4LIBRARY_API_KEY` | 로컬 데이터 수집 시에만 | `scripts/fetch-library-books.ts`, `scripts/lookup-library.ts` 실행에만 필요. **Vercel에는 등록하지 않는다** (production은 실시간 호출을 하지 않으므로 불필요) |

`.env*`는 `.gitignore`에 포함되어 있고, git history에도 커밋된 적이 없다.

## 로컬 실행

```bash
npm install
npm run dev
```

`DATABASE_URL`을 비워두면 [src/lib/mock-data.ts](../src/lib/mock-data.ts)의 데모 데이터로 화면 흐름만 확인할 수 있다 (화면에 "데모 데이터" 배너 표시). 실제 데이터로 확인하려면 아래 "Prisma / Neon" 절차를 먼저 진행한다.

`package.json` scripts:

| 명령 | 설명 |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js 개발/빌드/실행 |
| `npm run lint` | ESLint |
| `npm run lookup:library -- --keyword=도서관명` | Data4Library `libSrch`로 실제 libCode 조회 |
| `npm run fetch:books -- --libCode=... --startDt=... --endDt=...` | Data4Library `itemSrch`로 실제 도서 수집 |
| `npm run db:seed` | `data/collected-books.json` + `data/quest-curation.json`을 Neon에 시드 |
| `npm run db:migrate` | (로컬 전용) `prisma migrate dev` |
| `npm run db:studio` | Prisma Studio |

`postinstall`에서 `prisma generate`가 자동 실행되므로(`npm install` 직후) 별도로 실행할 필요는 없다. Vercel 빌드에서도 동일하게 동작한다.

## Data4Library 수집 (현재 반영된 실데이터)

대전 원신흥도서관, libCode `130026` (`scripts/lookup-library.ts`로 확인 — 전국에서 도서관명 "원신흥도서관"은 1건뿐이며 주소가 "대전광역시 유성구 원신흥남로 59"임을 확인).

현재 `data/`에 반영되어 있는 실제 데이터 (repository 파일 기준):

- 원본(raw) 조회: `itemSrch`, libCode 130026, 2026-06-01~2026-08-19, 300건 (`data/snapshots/` 10개 페이지 파일)
- 큐레이션된 도서(curated): 36권 (`data/collected-books.json`)
- Quest 3개 / QuestStep 9개(퀘스트당 3단계) / QuestCandidate 36개(단계당 4개) (`data/quest-curation.json`)

재수집하거나 다른 도서관으로 바꾸려면 [data/README.md](../data/README.md)의 절차를 따른다. `itemSrch`는 `pageSize>=100`에서 504 Timeout이 발생해 `pageSize=30`으로 낮춰 두었다.

**`itemSrch`는 "등록 기간(startDt~endDt) 기준 조회"이며 실시간 대출 가능 여부가 아니다.** `registeredAt`(등록일)으로만 사용하며, 화면 어디에도 "지금 대출 가능"처럼 표현하지 않는다.

## Prisma / Neon

```bash
# .env에 Neon DATABASE_URL 설정 후
npx prisma generate
npx prisma migrate deploy   # 이미 생성된 마이그레이션만 적용 (destructive 아님)
npm run db:seed             # 실데이터만 시드
```

- `prisma/seed.ts`는 `data/collected-books.json`이 없으면 아예 실행되지 않는다 (가짜 데이터 시드 방지).
- 큐레이션(`quest-curation.json`)이 `collected-books.json`에 없는 ISBN을 참조하거나, 한 단계의 candidate가 3개 미만이거나, 같은 단계에 중복 ISBN이 있으면 seed가 즉시 실패한다.
- **production DB에 대해 `migrate reset`을 실행하거나 mock/생성 데이터를 시드하는 스크립트는 두지 않았다.** 마이그레이션은 항상 `migrate deploy`(기존 마이그레이션 파일 적용)만 사용한다.

## Mock 정책

[src/lib/data.ts](../src/lib/data.ts) 기준.

- `DATABASE_URL`이 **설정되어 있지 않을 때만** [src/lib/mock-data.ts](../src/lib/mock-data.ts)의 데모 데이터를 반환한다 (로컬 개발 편의용, 화면에 배너로 명시).
- `DATABASE_URL`이 설정된 상태에서 Prisma 쿼리가 실패하면(연결 실패, 인증 실패 등) 그 에러를 그대로 던진다 — 데모 데이터로 조용히 대체하지 않는다. `/quests` 세그먼트는 `error.tsx`로 사용자에게는 "데이터를 불러오지 못했습니다"만 보여주고 기술 상세는 노출하지 않는다.
- `/admin/review`, `/data-source`([src/lib/admin-data.ts](../src/lib/admin-data.ts))는 검수·출처 확인이 목적이므로 애초에 데모 대체가 없다. `DATABASE_URL` 미설정 시 "DB 연결 필요" 상태를 그대로 보여준다.

## ISBN 검증 구조

```
Client (QuestRunner)
  → ISBN 문자열 (카메라 인식 또는 직접 입력)
  → POST /api/quests/[questId]/steps/[stepId]/verify
  → 서버: ISBN 정규화 후 해당 QuestStep의 QuestCandidate.book.isbn13과 정확 일치 비교
  → { success: true, bookId, bookTitle } 또는 { success: false, message }
```

- 판정은 항상 서버 규칙 기반이며 AI가 정답 여부를 판단하지 않는다.
- 카메라 영상/이미지는 브라우저 메모리에서만 처리되고 서버로 전송되거나 저장되지 않는다. 서버에는 인식된 ISBN 문자열만 전달된다.
- 진행 상태(현재 단계, 발견한 책)는 서버 세션이 아니라 클라이언트 `localStorage`에 저장된다 (`QuestSession` 모델은 사용하지 않음). 8월 발표 시연 일정과 구현 리스크를 고려해 판정만 서버로 옮기고 세션은 서버화하지 않기로 했다.

## 모바일 바코드 스캔 (`@zxing/browser`)

[src/components/BarcodeScanner.tsx](../src/components/BarcodeScanner.tsx).

- native `BarcodeDetector` API에 의존하지 않는다 — Android/iOS 주요 브라우저(네이버 인앱 포함)에서 지원 여부가 일정하지 않아 카메라 스캔 자체가 막히는 문제가 있었다.
- `getUserMedia({ video: { facingMode: { ideal: "environment" } } })`로 후면 카메라를 우선 요청하고, `BrowserMultiFormatReader`(EAN-13 포맷으로 제한)로 `<video>` 스트림에서 지속적으로 디코딩한다.
- 카메라는 사용자가 "카메라로 바코드 스캔" 버튼을 누른 시점에만 켜진다. 페이지 진입 시 자동으로 권한을 요청하지 않는다.
- 인식 성공 / 사용자 취소 / 컴포넌트 언마운트(단계 이동 등) 시 `IScannerControls.stop()`으로 스트림을 반드시 종료한다. `QuestRunner`에서 `key={currentStep.id}`로 단계마다 컴포넌트를 새로 마운트해, 단계 이동 시 이전 스트림이 남지 않게 한다.
- 오류는 `NotAllowedError`(권한 거부), `NotFoundError`(카메라 없음), 그 외(초기화 실패)로 구분해 사용자에게 안내하고, 어떤 경우든 ISBN 직접 입력은 항상 가능하다.
- 인식된 값은 기존 `normalizeIsbn`을 거쳐 verify API로 전달될 뿐, 스캐너 자체는 정답 여부를 판단하지 않는다.

## Vercel / Cloudflare

- GitHub: `herb39/Lib-Quest`
- Production: `https://quest.lib.lc`
- Vercel(Hobby)에 Next.js 프로젝트를 Import하고 `DATABASE_URL`만 환경변수로 등록한다 (`DATA4LIBRARY_API_KEY`는 등록하지 않음).
- Custom Domain으로 `quest.lib.lc`를 추가하고, Cloudflare에서 `quest` 서브도메인에 대해 CNAME 레코드를 **DNS only(회색 구름)**로 등록한다. 계정별 CNAME target 값(Vercel이 제시하는 실제 호스트명)은 문서에 하드코딩하지 않고 Vercel Domains 화면에서 확인한다.
- 이전에 쓰던 `lib-quest.lib.lc`(Vercel/Cloudflare 설정)는 삭제되었다. 공식 production URL은 `https://quest.lib.lc` 하나뿐이다.

## 테스트

```bash
npx tsc --noEmit
npm run lint
npm run build
```

DB 연결이 가능한 로컬 환경이라면 추가로 확인한다.

- `/quests` — DB의 퀘스트 3개가 데모 배너 없이 노출되는지
- `/quests/[id]` — 실제 후보 도서(청구기호 등)로 QuestRunner가 렌더링되는지
- `POST /api/quests/[questId]/steps/[stepId]/verify` — 정답/오답/다른 단계 candidate ISBN 3가지 케이스
- `/admin/review`, `/data-source` — DB 실데이터가 그대로 표시되는지

## 보안 및 운영 주의사항

- `.env`는 절대 커밋하지 않는다 (`.gitignore`에 `.env*` 포함, 이미 확인됨).
- Data4Library API key, DB 연결 문자열 등 실제 secret 값은 코드/문서/로그 어디에도 남기지 않는다.
- 카메라 영상/이미지는 서버로 전송하거나 저장하지 않는다. verify API에는 인식된 ISBN 문자열만 전달한다.
- production에서 DB 조회가 실패했을 때 mock 데이터로 조용히 대체하지 않는다 (에러를 그대로 노출해 사용자에게는 안내 화면만 보여준다).
- 어떤 화면에서도 Data4Library 데이터를 "지금 대출 가능"과 같은 실시간 대출 정보로 표현하지 않는다.
