# Lib Quest Development Guide

**대상: 개발자 / 시스템 관리자** (코드/DB/인프라를 유지보수하는 사람)

발표용 MVP의 기술 구조와 로컬 개발/데이터 수집/배포 절차를 정리한 개발자 문서. 이 문서에는 기술적인 정보만 둔다.

- 서비스 소개, 이용 방법: [README.md](../README.md)
- 제품 방향/B2B2C 구조: [SERVICE_DESIGN.md](SERVICE_DESIGN.md)
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

`prisma/schema.prisma` 기준. 다중 도서관 지원을 위해 스키마를 변경한 적은 없다 — `libraryId` 외래키가 애초에 모든 모델에 있어 도서관을 몇 개 붙이든 구조 변경이 필요 없다. 단일→다중 도서관 확장은 전부 애플리케이션 레이어(`src/lib/config.ts`의 `LIBRARIES` 목록, 각 조회 함수의 `libraryCode` 매개변수, 화면의 도서관 선택 UI)에서 처리한다. (P1에서 운영 콘텐츠를 위해 `BookEditorial`/`MissionContent` 두 모델을 추가한 것이 이 프로젝트의 첫 스키마 변경이다 — 아래 참고.)

- `Library` — 도서관. `code`(libCode, unique), `name`. 현재 4곳이 등록되어 있다 (아래 "Data4Library 수집" 참고).
- `Book` — 실제 수집 도서. `isbn13`, `title`, `author`, `classNo`/`className`(KDC), `callNumber`, `shelfLocation`, `registeredAt`, `source`. `@@unique([libraryId, isbn13])`라 같은 ISBN이 다른 도서관에 각각 존재할 수 있다. `editorial BookEditorial?`(1:1, optional) 역참조를 갖는다.
- `Quest` — 퀘스트. `title`, `description`, `theme`, `estimatedMinutes`, `difficulty`, `published`
- `QuestStep` — 퀘스트 단계. `order`, `title`, `description`, `hint`. `missionContent MissionContent?`(1:1, optional) 역참조를 갖는다.
- `QuestCandidate` — 단계별 후보 도서 (`QuestStep` ↔ `Book`, `isPrimary`)
- `QuestSession` — 스키마에는 존재하지만 **현재 애플리케이션 코드에서 실제로 사용하지 않는다.** 진행 상태는 클라이언트 `localStorage`로 관리한다 (아래 "ISBN 검증 구조 / 세션 정책" 참고). 추후 서버 세션이 필요해지면 확장할 자리로 남겨둔 것.
- `BookEditorial`(P1) — `bookId`(1:1, unique) + `hook`/`teaser`/`question` + `reviewStatus`(`ReviewStatus`) + `isPublished`. 운영자가 `/admin/review`에서 편집하는 책 소개 콘텐츠의 DB source of truth.
- `MissionContent`(P1) — `questStepId`(1:1, unique) + `missionTitle`/`missionNarrative` + `reviewStatus` + `isPublished`. 동일한 정책의 Step 안내 콘텐츠.
- `ReviewStatus`(enum) — `DRAFT` | `REVIEW_NEEDED` | `APPROVED`. `isPublished`(Boolean)와 별도 축이다 — "검수 완료했지만 아직 비공개"가 가능해야 한다는 운영 요구사항 때문에 하나의 상태값으로 합치지 않았다.

## 프로젝트 구조

```
src/
  app/
    page.tsx                 # 홈
    quests/page.tsx          # 퀘스트 목록 (DB 조회)
    quests/[id]/page.tsx     # 퀘스트 상세 (DB 조회) + QuestRunner
    quests/error.tsx         # /quests 세그먼트 공용 에러 화면
    admin/review/page.tsx    # 운영 콘솔 페이지 (서버 컴포넌트: 데이터 조회만, 실제 화면은 AdminConsole)
    data-source/page.tsx     # 데이터 출처 화면
    api/quests/[questId]/steps/[stepId]/verify/route.ts  # ISBN 서버 판정 API
    api/admin/book-editorials/[bookId]/route.ts   # Book Editorial 저장/검수/공개 PATCH
    api/admin/mission-contents/[stepId]/route.ts  # Mission Content 저장/검수/공개 PATCH
    api/admin/demo-reset/route.ts                 # 도서관 단위 운영 콘텐츠 baseline 복원 POST
  components/
    Header.tsx                 # 공통 헤더 (좌: Lib Quest 홈 링크, 우: /admin 이외 라우트에서 "처음부터" 전체 초기화 버튼)
    QuestRunner.tsx           # 퀘스트 진행 클라이언트 컴포넌트 (localStorage 세션 + 도감/관심/오늘의 한 권)
    DiscoveryCard3D.tsx        # 순수 CSS 3D 책 오브젝트 (표지/책등/페이지/뒤표지, hidden ↔ revealed)
    DiscoveriesView.tsx        # /discoveries 클라이언트 화면 (도감/XP/칭호/필터)
    MyExploration.tsx          # 홈 "나의 탐험" 요약 (client)
    LibraryProgress.tsx        # 홈 도서관 카드의 "N/전체 발견" 진행도 (client)
    BarcodeScanner.tsx         # ZXing 기반 카메라 바코드 스캐너
    CopyIsbnButton.tsx          # /admin/review 전용 ISBN 클립보드 복사 버튼
    AdminConsole.tsx            # 운영 콘솔 클라이언트 화면 (Quest/Step navigator + Mission/Editorial 편집기 + 데모 초기화, P1)
  lib/
    config.ts                 # 지원 도서관 목록(LIBRARIES) + 기본 도서관(DEFAULT_LIBRARY_CODE)
    data.ts                   # /(홈), /quests, /quests/[id]용 DB 조회 (DB 없으면 데모 데이터)
    admin-data.ts              # /admin/review(운영 콘솔), /data-source용 DB 조회 (데모 대체 없음)
    admin-content.ts            # /api/admin/* write route 공용 validation/정책(canPublish 등)
    content-baseline.ts          # book-editorial.json/quest-missions.json baseline reader (import·reset 스크립트 전용)
    mock-data.ts               # 로컬 개발 전용 데모 데이터 (실데이터 아님)
    prisma.ts                  # Prisma Client 싱글턴 (adapter-pg)
    types.ts                   # 화면용 공용 타입
    covers.ts / cover-urls.json     # ISBN → 표지 이미지 URL 정적 조회 (raw snapshot 기반)
    discovery-storage.ts        # 발견 도감 localStorage (QuestSession과 분리)
    interest-storage.ts         # "읽어보고 싶어요" 관심 표시 localStorage (도감과 별도 개념)
    final-selection-storage.ts   # Quest별 "오늘의 한 권" 선택 localStorage
    reset-user-state.ts          # Header "처음부터" 전용 — Lib Quest 소유 localStorage key만 선택 삭제
prisma/
  schema.prisma
  migrations/                 # 라이브 DB 연결 없이 `migrate diff`로 생성한 마이그레이션들(shadow DB 불필요)
  seed.ts                     # data/libraries/* 폴더를 전부 순회하며 시드
scripts/
  lookup-library.ts           # Data4Library libSrch로 실제 libCode 조회
  fetch-library-books.ts      # Data4Library itemSrch로 실제 도서 수집 (data/libraries/<libCode>/에 저장)
  import-editorial-content.ts # book-editorial.json/quest-missions.json → BookEditorial/MissionContent DB 최초 시드(idempotent)
  update-quest-descriptions.ts # Quest.description(퀘스트 목록 teaser)만 JSON 기준으로 갱신하는 일회성 스크립트
data/
  README.md                   # 수집 절차 상세, 도서관별 수집 이력, 검토 후 제외한 도서관 목록
  snapshots/                  # itemSrch 원본 응답 (파일명에 libCode 포함, authKey 미포함)
  libraries/
    130026/  125004/  125010/  130012/   # 도서관별 collected-books.json + quest-curation.json
    130026/book-editorial.json           # (원신흥만) teaser/hook/question
    130026/quest-missions.json           # (원신흥만) missionTitle/missionNarrative
docs/
  SERVICE_DESIGN.md             # 제품 방향 / B2B2C / 게임화 원칙
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
| `npm run db:seed` | `data/libraries/` 아래 모든 도서관 폴더를 Neon에 시드 (이미 있는 Quest는 건너뜀) |
| `npm run db:migrate` | (로컬 전용) `prisma migrate dev` |
| `npm run db:studio` | Prisma Studio |

`postinstall`에서 `prisma generate`가 자동 실행되므로(`npm install` 직후) 별도로 실행할 필요는 없다. Vercel 빌드에서도 동일하게 동작한다.

## Data4Library 수집 (현재 반영된 실데이터)

대전 지역 공공도서관 4곳을 실제 Data4Library API로 확인·수집해 지원한다 (`scripts/lookup-library.ts`로 libCode 확인, 후보 도서관 중 청구기호/서가위치 필드 완전성이 높은 곳만 채택 — 검토했으나 제외한 도서관 목록은 [data/README.md](../data/README.md) 참고).

| libCode | 도서관 | 지역 | 비고 |
| --- | --- | --- | --- |
| 130026 | 대전 원신흥도서관 | 유성구 | 대표 시연 도서관 |
| 125004 | 대전 갈마도서관 | 서구 | |
| 125010 | 대전 가수원도서관 | 서구 | Quest1 구성을 실제 재고에 맞게 조정(상세는 data/README.md) |
| 130012 | 대전 노은도서관 | 유성구 | |

도서관마다 `data/libraries/<libCode>/`에 `collected-books.json`(36권) + `quest-curation.json`(Quest 3 · Step 9 · Candidate 36)이 있다. 4곳 합계는 Library 4 / Book 144 / Quest 12 / QuestStep 36 / QuestCandidate 144. 재수집하거나 도서관을 추가하려면 [data/README.md](../data/README.md)의 절차를 따른다. `itemSrch`는 `pageSize>=100`에서 504 Timeout이 발생해 `pageSize=30`으로 낮춰 두었다.

**`itemSrch`는 "등록 기간(startDt~endDt) 기준 조회"이며 실시간 대출 가능 여부가 아니다.** `registeredAt`(등록일)으로만 사용하며, 화면 어디에도 "지금 대출 가능"처럼 표현하지 않는다.

## 다중 도서관 URL 구조

라우터를 새로 만드는 대신 기존 `/quests`, `/admin/review`에 `?library=<libCode>` 쿼리 파라미터를 추가하는 방식을 택했다 (발표 일정상 과도한 라우팅 리팩토링을 피하기 위함).

- `/` — `getLibraryList()`로 전체 도서관을 카드로 보여준다. 각 카드가 `/quests?library=<libCode>`로 연결된다.
- `/quests?library=<libCode>` — 파라미터가 없으면 `DEFAULT_LIBRARY_CODE`(원신흥도서관)로 대체된다. DB에 없는 코드면 `notFound()`.
- `/quests/[id]` — 퀘스트 `id`가 이미 전역적으로 유일(cuid)하므로 URL에 library 파라미터가 필요 없다. `QuestSummary.libraryName`으로 상단에 도서관명을 표시한다.
- `/admin/review?library=<libCode>` — 상단 탭으로 도서관을 전환한다. 파라미터가 없으면 기본 도서관.
- `/data-source` — 도서관 파라미터 없이 전체 도서관을 한 화면에 나열한다.

## 콘텐츠·게임화 데이터 구조

서비스 방향(발견 → 관심 → 선택)에 대한 배경은 [SERVICE_DESIGN.md](SERVICE_DESIGN.md) 참고. 여기서는 구현 세부만 다룬다.

### 표지 이미지 (`src/lib/covers.ts`, `src/lib/cover-urls.json`)

Data4Library `itemSrch` 원본 응답에는 `bookImageURL` 필드로 실제 표지 URL이 들어있다. 이 필드는 curated `collected-books.json`/DB `Book` 테이블에는 없으므로(스키마 변경을 피하기 위해), `data/snapshots/*.json`에서 ISBN 기준으로 값을 그대로 추출해 `src/lib/cover-urls.json`(정적 JSON, git import)에 저장해 두고 `getCoverUrl(isbn13)`으로 조회한다. 큐레이션된 144권 중 139권이 매칭되며(나머지는 원본에도 이미지가 없음), 임의로 만든 URL은 없다. 실제 호스트 분포는 `image.aladin.co.kr` 122건, `shopping-phinf.pstatic.net` 17건 2곳뿐이다(`bookthumb-phinf.pstatic.net`은 현재 데이터에 없음). `next/image`는 호스트가 여러 곳이라 `remotePatterns`가 불필요하게 복잡해지므로 사용하지 않고 일반 `<img>`를 쓴다 — 프로젝트 전체에서 `next/image`의 `<Image>`는 어디에도 쓰이지 않는다(Vercel image optimizer 경유 없음).

**표지가 쓰이는 화면**: `DiscoveryCard3D`(Mission의 숨김 책 슬롯/진행 슬롯, Discovery Hero, BookInfo 상단 썸네일, Final Selection 히어로, `/discoveries` grid)와 `QuestRunner.tsx`의 로컬 `BookThumb`(오늘 만난 세 권 선택 목록, 완료 화면의 발견 목록) 두 곳 — 이 두 곳 모두 표지 `<img>`를 그린다.

**간헐적 로딩 실패 조사**: 실기기(iPhone/네이버 인앱 브라우저)에서 표지가 간헐적으로 안 보이는 문제가 보고되어, 전체 139개 URL을 각 2회씩(총 278회) 서버에서 직접 요청해 재현을 시도했으나 **전부 200 OK, 오류/타임아웃/간헐 실패 0건**이었다 — 즉 CDN 자체가 불안정하다는 증거는 찾지 못했다. Referer 유무(무/quest.lib.lc/naver.com)에 따른 차단도 관찰되지 않았다. 따라서 근본 원인은 host 쪽보다 **클라이언트 이미지 로딩 lifecycle**(캐시된 이미지의 `onLoad` 미발화, 재요청 없는 고정 `onError → fallback`)일 가능성이 높다고 판단해, 아래 공통 로딩/재시도 전략으로 대응했다.

**공통 로딩/재시도** (`src/lib/use-retrying-cover-image.ts`의 `useRetryingCoverImage` hook, `DiscoveryCard3D`/`BookThumb` 공용): 상태는 `idle → loading → loaded` 또는 `loading → retrying → loaded/failed` 만 존재하는 단순 state machine이다. `onError` 시 최대 1회, 500ms 지연 후 재시도한다 — `<img>`의 `key`를 증가시켜 엘리먼트를 리마운트하는 방식으로 실제 네트워크 재요청을 강제한다(같은 `src`에 state만 바꾸면 브라우저가 재요청하지 않을 수 있음). cache-bust 쿼리는 붙이지 않는다(외부 CDN에 새 URL을 만들어 불필요하게 요청하지 않기 위함). 재시도까지 실패하면 `failed` 상태로 고정하고 📕 + "표지 이미지 없음" fallback을 보여준다 — 무한 재시도는 절대 하지 않는다. development 환경에서만(`NODE_ENV !== "production"`) `console.warn`으로 URL/host/retry 횟수를 남긴다(민감 정보 없음, production 사용자 콘솔은 오염시키지 않음).
- **loading/decoding**: Discovery Hero(`size="hero"`)와 그 외 대부분(active/slot, BookThumb)은 `loading="eager"`— 발견 직후 바로 봐야 하는 핵심 보상이거나 개수가 적어(최대 3장) 지연 로딩의 이득이 없다. `/discoveries` grid(`size="grid"`)만 `loading="lazy"` — 최대 144장까지 늘어날 수 있어 화면 밖 이미지는 지연 로딩한다. 모든 `<img>`에 `decoding="async"`를 붙여 디코딩이 메인 스레드를 막지 않게 한다.
- **Discovery Hero preload**: `QuestRunner`의 `handleVerify`가 성공 응답에서 `coverUrl`을 얻는 즉시 `new Image()`로 fire-and-forget preload를 시작한다(실패해도 무시, 화면 전환을 기다리게 하지 않음) — Discovery 화면의 실제 `<img>`가 같은 URL을 요청할 때 브라우저 캐시 히트로 즉시 표시되게 하기 위함.
- **fallback 독립성**: `useRetryingCoverImage`는 `DiscoveryCard3D`/`BookThumb` 인스턴스마다 독립된 local state(useState/useRef)라 한 카드의 실패가 다른 카드에 전혀 영향을 주지 않는다(`/discoveries` grid 한 장 실패가 grid 전체를 깨뜨리지 않음, Discovery Hero/BookInfo/Final Selection도 표지 실패와 무관하게 제목/저자/hook/관심/CTA 등 텍스트 콘텐츠와 3D 책의 spine/pages/back 레이어는 항상 정상 렌더링된다).
- **외부 CDN 직접 의존 유지 결정**: 이번 조사에서 host 불안정성의 증거를 찾지 못했으므로, 서버 proxy(`/api/book-cover`)나 142개 이미지 자체 재호스팅 없이 **외부 URL 직접 사용 + retry/fallback**(대안 A) 그대로 유지한다. proxy는 Vercel bandwidth·구현 복잡성이 늘고, 자체 재호스팅은 저작권/재배포 근거가 불명확한 이미지를 복제하는 리스크가 있다 — 둘 다 지금 단계에서 정당화할 증거가 없다. referrerPolicy/crossOrigin도 실제 차단이 관찰되지 않아 추가하지 않았다(불필요한 속성 추가가 오히려 기존에 잘 보이던 이미지를 깨뜨릴 수 있음). Service Worker/PWA 캐시는 이 프로젝트에 아예 없다(`manifest.json`은 아이콘/메타데이터 전용, `navigator.serviceWorker.register` 호출 없음).

### Book Editorial / Mission Content — DB가 source of truth (P1)

책 발견 직후 보여주는 teaser(짧은 소개)/hook(끌리는 이유 한 줄)/question(읽기 전 질문), 그리고 Step 진입 시 보여주는 missionTitle/missionNarrative는 **Lib Quest가 실제 제목·부제·저자·KDC 분류만 근거로 직접 작성한 정적 콘텐츠**다(Data4Library는 줄거리/키워드 필드를 제공하지 않으므로 소설류는 구체적 줄거리를 상상하지 않고 장르·작가 소개 수준으로 제한). P1 이전에는 이 콘텐츠가 `data/libraries/<libCode>/book-editorial.json`, `quest-missions.json` 파일 자체가 런타임 조회 대상이었지만, P1부터는 **`BookEditorial`/`MissionContent` Prisma 모델이 runtime source of truth**이고, JSON은 초기 시드값/데모 복원 기준(baseline)으로만 남는다.

**Mission Content(발견 이전)와 Book Editorial(발견 이후)은 서로 다른 콘텐츠다:**

| | Mission Content | Book Editorial |
| --- | --- | --- |
| 언제 보여주는가 | 책을 찾기 전(Step 진입 시) | 책을 발견한 후(verify 성공 시) |
| 무엇에 대한 콘텐츠인가 | Quest/Step 자체의 분위기·서사 | 특정 책 한 권의 소개 |
| 정답 정보인가 | 아니다 — 공개해도 안전 | 그렇다 — 인증 전 redaction 대상 |
| DB 모델 | `MissionContent`(`questStepId` 1:1) | `BookEditorial`(`bookId` 1:1) |

실제 행동 지시("무엇을 찾아야 하는지")는 이 모델들이 다루지 않고 항상 실제 `QuestStep.description`을 그대로 보여준다 — Mission Content는 그 앞을 감싸는 분위기일 뿐이다.

**검수 상태와 공개 여부는 서로 다른 축**이다(`ReviewStatus` enum: `DRAFT`/`REVIEW_NEEDED`/`APPROVED`, 그리고 별도 `isPublished: Boolean`). "검수는 끝났지만 아직 공개하지 않음"이 가능해야 하기 때문이다. 서버는 `isPublished=true`를 `reviewStatus=APPROVED`일 때만 허용한다(`src/lib/admin-content.ts`의 `canPublish`).

**사용자 화면 lookup**: `getQuestDetail()`(`src/lib/data.ts`)이 각 Step에 대해 `missionContent`가 `isPublished`일 때만 `mission` 필드로 채워 `QuestRunner`에 전달하고(미공개/없음이면 `null` → QuestRunner의 generic fallback 문구), verify API(`/api/quests/[questId]/steps/[stepId]/verify`)는 매칭된 책의 `editorial`이 `isPublished`일 때만 hook/teaser/question을 응답에 넣는다. **미공개(DRAFT/REVIEW_NEEDED) 콘텐츠가 사용자 화면에 노출되는 경로는 없다** — `/admin/review`만 검수 목적으로 모든 상태를 그대로 보여준다.

**JSON baseline의 역할**: `data/libraries/<libCode>/book-editorial.json`, `quest-missions.json`은 이제 두 곳에서만 읽힌다(`src/lib/content-baseline.ts`) — (1) `scripts/import-editorial-content.ts`: 최초 1회 DB에 넣는 시드, 이미 row가 있으면 건너뛰는 idempotent 스크립트. (2) `/api/admin/demo-reset`: 운영자가 수정한 내용을 이 baseline으로 되돌리는 초기화. 현재 대전 원신흥도서관만 baseline이 있다(book editorial 36건, mission content 9건) — import 후 DB에 정확히 그 수만큼 `reviewStatus=APPROVED, isPublished=true`로 들어간다.

### 발견 도감 / 관심 / 오늘의 한 권 (localStorage, 서로 분리된 3개 저장소)

| 저장소 | 키 | 의미 | QuestSession과의 관계 |
| --- | --- | --- | --- |
| `discovery-storage.ts` | `libquest_discoveries` | 실제로 발견한 책 누적 기록(도감). `bookId`당 1건, 중복 발견 시 새로 추가하지 않음 | 완전히 분리 — 도감 초기화가 진행 중인 Quest에 영향을 주지 않음 |
| `interest-storage.ts` | `libquest_interests` | "읽어보고 싶어요" 표시한 `bookId` 목록 | 도감과도 분리 — 발견 여부와 관심 여부는 다른 개념이라 한 레코드에 묶지 않았다 |
| `final-selection-storage.ts` | `libquest_final_selections` | Quest별 "오늘의 한 권" 선택(`questId`→`bookId`+`selectedAt`) | Quest 하나당 최신 선택 1건. 실제 대출 여부와는 무관 |
| `QuestRunner.tsx`(session) | `libquest_session_<questId>` | Quest별 현재 진행 상태(`currentStep`/`foundBooks`/`completedAt`/`started`) | 위 3개 저장소와 별개. Quest마다 key가 따로 있다(prefix `libquest_session_`) |

XP는 `getXp = 발견 도감 unique 권수 × 10`으로 **항상 재계산**하며 별도 mutable 숫자를 저장하지 않는다. 탐험 칭호(`getExplorerTitle`)도 XP 임계값 기반 순수 함수다. 네 저장소 모두 SSR-safe(`typeof window` 가드), JSON 파싱 실패/버전 불일치 시 빈 상태로 안전하게 대체한다.

### 전체 사용자 상태 초기화 (`src/lib/reset-user-state.ts`)

Header의 `처음부터` 버튼이 호출하는 `resetLibQuestUserState()`는 위 표의 **Lib Quest 소유 key만** 선택 삭제한다 — `libquest_session_` prefix를 가진 모든 key(현재까지 플레이한 모든 Quest 세션)를 순회 삭제하고, `libquest_discoveries`/`libquest_interests`/`libquest_final_selections`를 지운다. `localStorage.clear()`는 쓰지 않는다(같은 origin에 Lib Quest가 모르는 다른 값이 있을 수 있으므로). 확인 모달에서 "처음부터 시작"을 누르면 실행 후 `window.location.href = "/"`로 완전한 새로고침을 한다 — `router.push`가 아니라 전체 새로고침을 택한 이유는, 홈/도서관 카드/QuestRunner 등 여러 클라이언트 컴포넌트가 마운트 시점에만 localStorage를 읽으므로(hydration-safe 패턴) 라우팅만으로는 이미 렌더된 컴포넌트들이 새 상태를 반영하지 못할 수 있기 때문이다.

### DiscoveryCard3D — 3D 책 오브젝트 (`src/components/DiscoveryCard3D.tsx`)

P0-3에서 "카드 flip"이 아니라 **두께가 있는 책 오브젝트**로 재구성했다(이름은 호출부 변경 범위를 늘리지 않기 위해 유지). 순수 CSS 3D(`perspective`/`transform-style: preserve-3d`/`translateZ`/`rotateX·Y·Z`)만 쓰고 외부 애니메이션 라이브러리·WebGL·Three.js는 쓰지 않는다.

**DOM/transform 레이어 구조** (역할별로 분리 — 하나의 element에 pointer tilt/idle/reveal/기본 자세를 전부 몰아넣으면 서로의 transform을 덮어써 충돌한다):

```
lq-book-scene      perspective(1100px)만 담당
└ lq-book-interact  ref 대상. pointer tilt만 이 레이어의 style.transform을 직접 갱신
  └ lq-book-reveal   발견 순간 1회성 materialize 키프레임 전용 (평소엔 transform 없음)
    └ lq-book-pose     책의 고정 기본 자세: rotateX(3deg) rotateY(-10deg) rotateZ(-1deg)
      ├ lq-book-back    translateZ(-depth)      뒤표지 — generic neutral gradient
      ├ lq-book-pages   translateZ(-depth*0.45) 페이지 단면 — ivory/warm-white repeating-gradient
      ├ lq-book-spine   translateZ(-depth*0.75) 책등 — 어두운 gradient (실제 책등 정보 없음, 두께감 목적)
      └ lq-book-cover   translateZ(0)           표지 — 가장 큰 면, cover-layer 2장을 opacity crossfade
```

`--lq-depth`는 size별 CSS 변수(hero 22px / active 12px / grid 8px / slot 3px)로 책 두께를 조절한다. 표지(`lq-book-cover`) 안에는 hidden(`?` + "숨겨진 책") / revealed(실제 이미지 또는 fallback) 두 레이어가 겹쳐 있고 `opacity` transition으로 크로스페이드한다 — flip처럼 180도 회전시키지 않는다(뒤표지/책등이 실제 정보 없이 두께 표현용이라 회전시켜도 얻을 게 없고, "숨겨진 책 → 발견된 책"은 회전보다 "눈앞에 나타나는" materialize 쪽이 더 자연스럽다).

- **hidden ↔ revealed**: `revealed` prop으로 표지 레이어 크로스페이드. `justRevealed`가 true면 마운트 후 짧은 지연을 두고 `lq-book-reveal`에 `lq-book-materialize` 키프레임(약 0.9초 — 뒤로 살짝 물러났다 떠오르며 정착, `translateZ`+`scale`만 사용)을 재생하고 그 순간 표지가 크로스페이드된다. 이미 발견된 슬롯/도감 책은 애니메이션 없이 바로 최종 상태로 그린다.
- **ground shadow**: 책 아래 별도 `lq-book-shadow` 엘리먼트(정적 `radial-gradient` + `filter: blur`)가 materialize와 같은 타이밍에 opacity/scale만 애니메이션한다(blur 값 자체는 애니메이션하지 않음 — 매 프레임 blur 재계산은 성능 비용이 크다).
- **PC pointer tilt**: `pointermove`(mouse만) 기준 카드 중심 대비 오프셋을 계산해 `requestAnimationFrame`으로 스로틀링한 뒤 `lq-book-interact` ref의 `style.transform`을 직접 갱신한다(React state로 매 프레임 리렌더하지 않음). 이 tilt는 `lq-book-pose`의 고정 자세와는 별도 레이어라 서로 곱해져(중첩 3D transform) 자연스럽게 더해진다.
- **모바일 touch tilt**: `pointerdown` 시점 위치로 즉시 한 번 기울인 뒤, 이후 `pointermove`를 계속 추적해 손가락 위치를 따라간다(각도 범위는 rotateX ±7deg / rotateY ±9deg, scale 1.025 — 실기기 피드백에 따라 두 차례 상향했다. 좌우 이동(rotateY)을 상하보다 살짝 크게 둔 이유는 spine/page edge 노출 변화가 좌우 tilt에서 더 크게 드러나기 때문). 터치 입력에만 정규화된 pointer offset에 `TOUCH_TILT_SENSITIVITY`(1.2) 배율을 곱해 카드 중앙에서 조금만 움직여도 반응이 빠르게 시작되게 하되, 결과는 항상 `±1`로 clamp한 뒤 max deg를 곱해 각도 상한을 절대 넘지 않는다(`applyTilt`의 `clamp` 참고). `pointerup/cancel`에서 원위치. `preventDefault()`/`setPointerCapture()`는 사용하지 않고 `touch-action: pan-y`만 유지한다 — 제스처가 세로 스크롤로 판단되면 브라우저가 자체적으로 `pointercancel`을 보내 추적이 멈추므로 스크롤을 절대 가로막지 않는다. (최초 버전은 `pointerdown` 시점에만 한 번 기울이고 `pointermove`는 추적하지 않아 "손가락을 움직여도 책이 반응하지 않는다"는 문제가 있었고, 그다음 버전은 `pointermove` 핸들러가 아직 커밋되지 않은 `interacting` state의 stale closure를 만나 프레임을 놓치는 문제가 있어 동기적인 `rectRef`로만 게이팅하도록 고쳤다.)
- **idle motion**: 현재 탐색 중인 hidden 책(`active && !revealed`)에만 `lq-book-reveal` 레이어에 은은한 CSS keyframe(translateY/rotate) 적용, 상호작용 중에는 클래스 자체를 떼어 정지한다.
- **reduced motion**: `prefers-reduced-motion` 감지 시 idle/materialize/shadow 애니메이션과 tilt transition을 전부 제거하고, 표지 크로스페이드(0.35s opacity transition)만으로 상태 전환을 표현한다.
- **성능**: `will-change: transform`은 상호작용 중이거나 idle 대상인 책에만 조건부로 붙인다(`lq-book-will-change` 클래스) — 도감 grid의 정적인 책 수십 장에 항상 걸어두지 않는다. 애니메이션은 `transform`/`opacity`만 사용(매 프레임 width/height/blur 재계산 없음).
- **표지 fallback**: `coverUrl`이 없거나 로드 실패(`onError`)하면 📕 아이콘 + "표지 이미지 없음" 텍스트로 대체하되 같은 책 오브젝트 레이어 구조(표지/책등/페이지) 그대로 유지한다 — 표지가 없다고 3D 구조 자체가 무너지지 않는다. 이 실패는 verify 성공/XP/도감 기록/다음 Step 진행에 전혀 영향을 주지 않는다(발견 로직과 표지 렌더링은 완전히 분리되어 있다).

### Mission → Discovery → BookInfo 화면 상태 (`QuestRunner.tsx`)

한 Step 안에서 발견 순간(감정적 보상)과 책 정보(독서 호기심)를 완전히 분리된 화면으로 나눈다. 별도 Next.js route를 만들지 않고 `QuestRunner` 내부 state(`stepView: "mission" | "discovery" | "bookInfo"`)만으로 전환한다 — history를 추가로 쌓지 않는다.

```
mission  (Mission Narrative + 탐험 단서 + hidden 책 + ISBN 인증 CTA)
  → verify 성공 → discovery (큰 revealed 책 + 제목/저자 + XP만, hook/teaser/question 없음)
    → "책 살펴보기" → bookInfo (작은 책 + hook 우선 + 읽어보고 싶어요 + teaser/question은 "책 더 알아보기"로 접힘)
      → "다음 탐사지역 열기" → 다음 Step의 mission (또는 마지막 Step이면 "결과 카드 보기" → 완료 화면)
```

`session.currentStep`(어느 Step인지)은 verify 성공 시점에 이미 다음 값으로 넘어가 있고, `stepView`는 그와 별개로 사용자가 "책 살펴보기"/"다음 탐사지역 열기"를 눌러야만 전환된다. 단계가 바뀔 때(`session.currentStep` 변경) 실행되는 정리용 `useEffect`는 `showHint`/`feedback`/`isbnInput`만 초기화하고 **`stepView`는 절대 건드리지 않는다** — 같은 이벤트 핸들러 안에서 `setSession`(단계 이동) 다음에 `setStepView("discovery")`를 호출하는데, 이 effect가 `stepView`를 "mission"으로 되돌리면 Discovery/BookInfo 화면을 건너뛰고 곧장 다음 Step으로 넘어가버리는 버그가 생긴다(실제로 이 문제가 있었고, effect에서 `stepView` 초기화 로직을 제거해 해결했다).

**Reload 정책**: `stepView`/`successInfo`는 컴포넌트 state일 뿐 localStorage에 저장하지 않는다. 사용자가 Discovery/BookInfo 화면에서 새로고침하면 `session`(이미 다음 단계로 이동된 상태)만 복구되어 **다음 Step의 Mission 화면**(또는 완료 상태면 결과 화면)으로 이어진다 — 방금 봤던 Discovery/BookInfo 화면이 재생되지는 않는다. 이 화면들을 복구하려면 세션에 "직전 발견 정보"까지 저장해야 하는데, 발표 환경에서 새로고침 도중 발견 연출을 다시 보여줘야 할 필요성은 낮고 저장 구조만 복잡해지므로 의도적으로 단순한 정책을 택했다.

### Exploration Result — 결과 화면 (`QuestRunner.tsx`의 `isCompleted` 분기, P0-4)

Quest의 마지막 Step까지 완료하고 "오늘의 한 권"을 고르면(`finalSelection`이 존재하면) 보여주는 화면이다. 새 localStorage key를 추가하지 않고, **이미 존재하는 4개의 독립 저장소를 그 자리에서 조합**해서 렌더링한다.

| 표시 항목 | 계산 방식 |
| --- | --- |
| 오늘의 한 권 Hero | `finalSelection.bookId`로 `session.foundBooks`에서 찾은 책. `DiscoveryCard3D`를 `revealed interactive size="active"`로 재사용(발견 연출 `justRevealed` 없이 — 여기는 발견이 아니라 선택의 결과) |
| 발견한 책 목록 | `session.foundBooks` 그대로, 3D Book이 아니라 기존 `BookThumb`(2D 썸네일) 재사용 — 성능/밀도 때문에 큰 3D 카드를 여러 장 그리지 않는다 |
| 관심 수 / ♥ 표시 | `interestStore`(`isInterested`)로 `foundBooks` 각각을 필터 |
| 현재 XP / 칭호 | `discoveryStore`(`getXp`/`getExplorerTitle`) — 도감 전체 기준, Quest와 무관하게 항상 정확 |
| 이번 탐험 XP | `foundBooks[].isNew`(아래 참고) 중 `true`인 개수 × 10 |

**"이번 탐험에서 실제로 새로 얻은 XP" 계산의 함정**: 발견 도감(`discovery-storage.ts`)은 book마다 **최초 발견 시점 1건만** 기록하므로, 이미 예전에 발견한 책을 이번 Quest에서 다시 만나도 도감에는 흔적이 남지 않는다 — 즉 도감만 봐서는 "이번 탐험에서 새로 얻은 XP"를 역산할 수 없다. 그래서 `FoundBook` 타입(이미 `libquest_session_<questId>`에 저장되던 것)에 `isNew?: boolean` 필드 하나만 추가해, `handleVerify`가 `recordDiscovery()`의 반환값을 그대로 세션에 함께 저장하게 했다 — **새 저장소가 아니라 기존 세션 레코드의 필드 추가**다. 이 필드 추가 이전에 저장된 세션(즉 이 필드가 없는 `foundBooks`)에 대해서는 "이번 탐험 XP"를 억지로 추정하지 않고, 대신 "현재 XP"(도감 전체 XP)만 보여준다(`foundBooks.every(b => typeof b.isNew === "boolean")`로 판별).

**중복 발견 문구**: 이번 탐험에서 만난 3권이 전부 신규 발견이면 "새로 발견한 책 3권"/"3권을 발견했고, 그중 한 권을 골랐어요.", 재발견이 하나라도 섞여 있으면 "이번 탐험에서 만난 책 3권"/"이번 탐험에서 3권의 책을 만났고, 그중 한 권을 골랐어요."로 표현을 구분한다 — "발견 3권"이 "신규 발견 3권"으로 오해되지 않게 하기 위함이다.

**정보 반복 금지**: 이 화면은 BookInfo에서 이미 보여준 teaser/question/청구기호/서가위치를 다시 노출하지 않는다 — "정보 소비 화면"이 아니라 "탐험 기록 화면"으로 설계했다.

## 인증 전 데이터 redaction (보안 경계)

`/quests/[id]/page.tsx`의 `redactCandidatesForPlay()`가 서버 컴포넌트 단계에서 각 Step의 후보(`title`/`author`/`isbn13`/`callNumber`)를 빈 값으로 치환한 뒤에만 클라이언트 컴포넌트(`QuestRunner`)에 전달한다.

**청구기호(callNumber)를 redact하는 이유**: 실제 큐레이션 데이터를 확인해보면 한 Step의 후보 4권은 `shelfLocation`/`className`이 항상 동일하지만 `callNumber`만 후보마다 다르다(예: 은942ㅅ vs 천423ㅇ). 즉 shelfLocation/className은 Step 전체에 공통되는 "탐색 범위" 정보라 인증 전에도 안전하지만, callNumber는 사실상 후보 한 권의 정체와 직접 연결되는 정보라 인증 전에는 아예 보내지 않는다. 발견 성공 후의 정확한 청구기호는 verify API 응답의 `bookCallNumber` 필드로 별도로 받는다(서가 위치는 Step 공통 값이라 클라이언트가 이미 가진 값을 그대로 쓴다).

**표지 URL과 teaser/hook/question도 같은 이유로 redaction 대상이다** — verify API가 `success: true`를 반환한 이후에만(`bookImageUrl`, `bookCallNumber`, `teaser`, `hook`, `question` 필드) 클라이언트가 받는다. 실패 응답에는 이 필드들이 전혀 포함되지 않는다.

**Mission Narrative(missionTitle/missionNarrative)는 redaction 대상이 아니다** — Quest/Step 자체의 분위기 콘텐츠일 뿐 특정 후보의 정답 정보가 아니므로 인증 전에도 그대로 노출된다.

`/admin/review`는 이 redaction을 거치지 않는 별도 조회(`getAdminReviewData`)라 후보 전체(청구기호 포함)와 콘텐츠가 그대로 노출된다(운영자 검수 목적이므로 의도된 동작).

## Prisma / Neon

```bash
# .env에 Neon DATABASE_URL 설정 후
npx prisma generate
npx prisma migrate deploy   # 이미 생성된 마이그레이션만 적용 (destructive 아님)
npm run db:seed             # 실데이터만 시드
```

- `prisma/seed.ts`는 `data/libraries/` 폴더가 없거나 비어 있으면 아예 실행되지 않는다 (가짜 데이터 시드 방지). 폴더 하나하나가 도서관 하나에 대응하며, 폴더명(libCode)이 `src/lib/config.ts`의 `LIBRARIES`에 없으면 에러로 중단한다.
- 큐레이션(`quest-curation.json`)이 같은 폴더의 `collected-books.json`에 없는 ISBN을 참조하거나, 한 단계의 candidate가 3개 미만이거나, 같은 단계에 중복 ISBN이 있으면 seed가 즉시 실패한다.
- 같은 도서관에 같은 title의 Quest가 이미 있으면 다시 만들지 않고 건너뛴다 — 여러 번 실행하거나 도서관을 하나씩 추가해도 기존 Quest가 중복 생성되지 않는다.
- **production DB에 대해 `migrate reset`을 실행하거나 mock/생성 데이터를 시드하는 스크립트는 두지 않았다.** 마이그레이션은 항상 `migrate deploy`(기존 마이그레이션 파일 적용)만 사용하며, 기존 데이터를 삭제하는 로직은 없다.
- **`Quest.description`(퀘스트 목록 카드의 teaser 문구)의 source of truth는 `data/libraries/<libCode>/quest-curation.json`의 `quests[].description`이다.** 단, 위 규칙대로 seed는 이미 존재하는 Quest를 건너뛰므로, **JSON만 고쳐서 재배포해도 이미 시드된 production 값은 바뀌지 않는다.** 기존 row의 description만 갱신해야 할 때는 `npx tsx scripts/update-quest-descriptions.ts`를 실행한다 — (libraryId, title) 기준으로 `description` 필드만 `updateMany`하며 Step/Candidate/Book 등 다른 관계는 전혀 건드리지 않는 일회성 스크립트다.

### Migration 생성 방식 (shadow DB 없이)

이 프로젝트는 Neon 무료 티어 하나만 쓰고 별도 shadow database가 없어서, `prisma migrate dev`(shadow DB 필요) 대신 **라이브 DB를 직접 `--from-config-datasource`로 diff**해서 마이그레이션 SQL을 생성한다(Prisma 7 CLI 기준, 예전 `--from-url` 플래그는 제거됨):

```bash
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_설명/migration.sql
npx prisma migrate deploy   # 생성된 마이그레이션을 실제로 적용
```

생성된 SQL은 반드시 적용 전에 직접 읽고 **additive-only인지(컬럼/테이블 삭제나 타입 변경이 없는지)** 확인한다. P1에서 추가한 `20260820120000_add_editorial_mission_content` 마이그레이션은 `CREATE TYPE`(enum) + `CREATE TABLE` × 2 + `CREATE UNIQUE INDEX` × 2 + `ADD FOREIGN KEY` × 2뿐이며, 기존 테이블에 대한 `ALTER`/`DROP`이 전혀 없다 — 기존 데이터에 영향을 주지 않는 순수 추가 변경이다.

### 운영 콘텐츠 write API (`/api/admin/*`, P1)

- `PATCH /api/admin/book-editorials/[bookId]`, `PATCH /api/admin/mission-contents/[stepId]` — 각각 `hook/teaser/question`, `missionTitle/missionNarrative`와 `reviewStatus`/`isPublished`를 받는다. **클라이언트 payload를 그대로 Prisma에 넘기지 않고**([src/lib/admin-content.ts](../src/lib/admin-content.ts)) 필드별로 화이트리스트 후 sanitize(trim, 빈 문자열→null, 길이 제한 — hook 160/teaser 500/question 240/missionTitle 60/missionNarrative 300자, 기존 baseline 콘텐츠의 최장 길이보다 넉넉히 크게 잡아 기존 데이터를 깨뜨리지 않는다)한다.
- **공개 조건**: `isPublished=true`는 (요청에 포함된 값이든 기존 저장값이든) 최종 `reviewStatus`가 `APPROVED`일 때만 허용한다. 아니면 400과 함께 "검수 완료 후 공개할 수 있어요."를 반환한다.
- **본문 수정 시 자동 재검수**: 요청이 텍스트 필드만 담고 있고(`reviewStatus`/`isPublished`를 명시적으로 보내지 않음) 기존 상태가 `APPROVED`였다면, 서버가 자동으로 `REVIEW_NEEDED` + `isPublished=false`로 되돌린다. 반대로 요청이 `reviewStatus`/`isPublished`를 명시하면 그 값이 우선한다 — Admin UI는 저장/검수 필요/검수 완료/공개/비공개 5개 버튼이 각각 다른 조합의 필드를 보내는 방식으로 이 정책을 구현한다(모든 버튼이 현재 textarea 값을 함께 보내 미저장 입력을 잃지 않는다).
- **create-on-first-save**: `bookId`/`questStepId`에 해당하는 row가 없어도 `upsert`로 그 자리에서 새로 만든다 — 콘텐츠가 아직 없는 책/Step도 운영자가 바로 입력해 저장할 수 있다.
- **에러 처리**: Prisma 에러 원문은 클라이언트에 노출하지 않는다. 서버는 `console.error`로 상세를 남기고, 클라이언트에는 "저장하지 못했어요. 다시 시도해주세요." 같은 안전한 메시지만 반환한다.
- `POST /api/admin/demo-reset` — body의 `libraryCode`를 `src/lib/config.ts`의 `LIBRARIES` 목록으로만 whitelist한다(클라이언트가 임의 문자열/경로를 넘기게 하지 않음). 이 도서관의 `BookEditorial`/`MissionContent`를 **Prisma `$transaction` 안에서 전부 delete 후 JSON baseline으로 재생성**한다(일부만 반영되는 상태 방지). `Library`/`Book`/`Quest`/`QuestStep`/`QuestCandidate`는 절대 건드리지 않는다. `GET` 핸들러를 export하지 않아 실수로 GET 요청이 와도 자동 405가 된다.
- 이 write API들에는 **인증이 없다**(공모전 데모 범위). 대신 write 가능한 대상을 운영 콘텐츠 두 모델로만 제한하고, delete는 오직 `demo-reset`의 도서관 단위 delete+recreate 트랜잭션 하나뿐이며 그 대상도 같은 두 모델뿐이다 — Book/Quest/QuestStep/QuestCandidate에 대한 write 경로는 어떤 API에도 없다.

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

- `/` — 도서관 4곳이 모두 카드로 노출되는지
- `/quests?library=<libCode>` — 선택한 도서관의 퀘스트 3개가 데모 배너 없이 노출되는지 (도서관별로 다른 책이 나와야 함)
- `/quests/[id]` — 실제 후보 도서(청구기호 등)와 소속 도서관명으로 QuestRunner가 렌더링되는지
- `POST /api/quests/[questId]/steps/[stepId]/verify` — 정답/오답/다른 단계 candidate ISBN 3가지 케이스
- `/admin/review?library=<libCode>`, `/data-source` — DB 실데이터가 도서관별로 정확히 표시되는지, cross-library candidate 오류가 없는지
- 발견 성공 시 `bookImageUrl`/`teaser`/`hook`/`question`이 verify 성공 응답에만 있고, 인증 전 페이지 payload(뷰소스 포함)에는 없는지
- `/discoveries` — 발견 도감/XP/칭호/도서관별 진행도/관심 필터가 실제 localStorage 값과 일치하는지
- Quest 완료 시 "오늘의 한 권" 선택 화면이 뜨고, 선택 후 새로고침해도 결과 화면에 그대로 반영되는지

## AI 사용 원칙과 analytics 설계

실시간 LLM을 사용자 요청마다 호출하지 않는 이유, teaser/hook/question 생성·검수 기준, 향후 analytics 이벤트 설계는 [SERVICE_DESIGN.md](SERVICE_DESIGN.md)의 "AI 사용 원칙"·"Roadmap" 절에 정리했다.

## 보안 및 운영 주의사항

- `.env`는 절대 커밋하지 않는다 (`.gitignore`에 `.env*` 포함, 이미 확인됨).
- Data4Library API key, DB 연결 문자열 등 실제 secret 값은 코드/문서/로그 어디에도 남기지 않는다.
- 카메라 영상/이미지는 서버로 전송하거나 저장하지 않는다. verify API에는 인식된 ISBN 문자열만 전달한다.
- production에서 DB 조회가 실패했을 때 mock 데이터로 조용히 대체하지 않는다 (에러를 그대로 노출해 사용자에게는 안내 화면만 보여준다).
- 어떤 화면에서도 Data4Library 데이터를 "지금 대출 가능"과 같은 실시간 대출 정보로 표현하지 않는다.
