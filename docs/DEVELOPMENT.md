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

`prisma/schema.prisma` 기준. 다중 도서관 지원을 위해 스키마를 변경한 적은 없다 — `libraryId` 외래키가 애초에 모든 모델에 있어 도서관을 몇 개 붙이든 구조 변경이 필요 없다. 단일→다중 도서관 확장은 전부 애플리케이션 레이어(`src/lib/config.ts`의 `LIBRARIES` 목록, 각 조회 함수의 `libraryCode` 매개변수, 화면의 도서관 선택 UI)에서 처리한다.

- `Library` — 도서관. `code`(libCode, unique), `name`. 현재 4곳이 등록되어 있다 (아래 "Data4Library 수집" 참고).
- `Book` — 실제 수집 도서. `isbn13`, `title`, `author`, `classNo`/`className`(KDC), `callNumber`, `shelfLocation`, `registeredAt`, `source`. `@@unique([libraryId, isbn13])`라 같은 ISBN이 다른 도서관에 각각 존재할 수 있다.
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
    Header.tsx                 # 공통 헤더 (좌: Lib Quest 홈 링크, 우: /admin 이외 라우트에서 "처음부터" 전체 초기화 버튼)
    QuestRunner.tsx           # 퀘스트 진행 클라이언트 컴포넌트 (localStorage 세션 + 도감/관심/오늘의 한 권)
    DiscoveryCard3D.tsx        # 순수 CSS 3D 책 오브젝트 (표지/책등/페이지/뒤표지, hidden ↔ revealed)
    DiscoveriesView.tsx        # /discoveries 클라이언트 화면 (도감/XP/칭호/필터)
    MyExploration.tsx          # 홈 "나의 탐험" 요약 (client)
    LibraryProgress.tsx        # 홈 도서관 카드의 "N/전체 발견" 진행도 (client)
    BarcodeScanner.tsx         # ZXing 기반 카메라 바코드 스캐너
    CopyIsbnButton.tsx          # /admin/review 전용 ISBN 클립보드 복사 버튼
  lib/
    config.ts                 # 지원 도서관 목록(LIBRARIES) + 기본 도서관(DEFAULT_LIBRARY_CODE)
    data.ts                   # /(홈), /quests, /quests/[id]용 DB 조회 (DB 없으면 데모 데이터)
    admin-data.ts              # /admin/review, /data-source용 DB 조회 (데모 대체 없음)
    mock-data.ts               # 로컬 개발 전용 데모 데이터 (실데이터 아님)
    prisma.ts                  # Prisma Client 싱글턴 (adapter-pg)
    types.ts                   # 화면용 공용 타입
    covers.ts / cover-urls.json     # ISBN → 표지 이미지 URL 정적 조회 (raw snapshot 기반)
    editorial.ts               # ISBN → teaser/hook/question 정적 조회 (book-editorial.json 기반)
    mission-content.ts          # (도서관, 퀘스트 제목, step order) → missionTitle/missionNarrative 정적 조회 (quest-missions.json 기반)
    discovery-storage.ts        # 발견 도감 localStorage (QuestSession과 분리)
    interest-storage.ts         # "읽어보고 싶어요" 관심 표시 localStorage (도감과 별도 개념)
    final-selection-storage.ts   # Quest별 "오늘의 한 권" 선택 localStorage
    reset-user-state.ts          # Header "처음부터" 전용 — Lib Quest 소유 localStorage key만 선택 삭제
prisma/
  schema.prisma
  migrations/                 # 라이브 DB 연결 없이 `migrate diff`로 생성한 초기 마이그레이션 포함
  seed.ts                     # data/libraries/* 폴더를 전부 순회하며 시드
scripts/
  lookup-library.ts           # Data4Library libSrch로 실제 libCode 조회
  fetch-library-books.ts      # Data4Library itemSrch로 실제 도서 수집 (data/libraries/<libCode>/에 저장)
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

Data4Library `itemSrch` 원본 응답에는 `bookImageURL` 필드로 실제 표지 URL(호스트: `image.aladin.co.kr`, `shopping-phinf.pstatic.net`, `bookthumb-phinf.pstatic.net`)이 들어있다. 이 필드는 curated `collected-books.json`/DB `Book` 테이블에는 없으므로(스키마 변경을 피하기 위해), `data/snapshots/*.json`에서 ISBN 기준으로 값을 그대로 추출해 `src/lib/cover-urls.json`(정적 JSON, git import)에 저장해 두고 `getCoverUrl(isbn13)`으로 조회한다. 큐레이션된 144권 중 142권이 매칭되며(2권은 원본에도 이미지가 없음), 임의로 만든 URL은 없다. `next/image`는 호스트가 3곳으로 다양해 `remotePatterns`가 불필요하게 복잡해지므로 사용하지 않고 일반 `<img>`(로딩/에러 상태는 컴포넌트에서 직접 처리)를 쓴다.

### 편집 콘텐츠 (`src/lib/editorial.ts`, `data/libraries/<libCode>/book-editorial.json`)

책 발견 직후 보여주는 teaser(짧은 소개)/hook(끌리는 이유 한 줄)/question(읽기 전 질문)은 Lib Quest가 실제 제목·부제·저자·KDC 분류만 근거로 직접 작성한 정적 콘텐츠다. Data4Library API는 줄거리/키워드 필드를 제공하지 않으므로(`class_no`/`class_nm`/`bookname`/`authors` 등만 존재), 소설류는 구체적 줄거리를 상상하지 않고 장르·작가 소개 수준으로 제한했다. `getEditorial(libraryCode, isbn13)`이 해당 도서관 JSON을 찾아 반환하며, 없으면 `null`(빈 콘텐츠를 억지로 채우지 않음). 현재 대전 원신흥도서관 36권만 작성되어 있다(`data/README.md` 참고).

### Mission Narrative (`src/lib/mission-content.ts`, `data/libraries/<libCode>/quest-missions.json`)

Step 안내를 "일본소설을 찾아보세요 / 찾아갈 곳: 종합자료실" 같은 지시문이 아니라, 앞 Step에서 자연스럽게 이어지는 짧은 탐험 서사(`missionTitle`/`missionNarrative`)로 감싼다. **Mission Editorial(발견 이전)과 Book Editorial(발견 이후)은 서로 다른 콘텐츠다:**

| | Mission Editorial(`mission-content.ts`) | Book Editorial(`editorial.ts`) |
| --- | --- | --- |
| 언제 보여주는가 | 책을 찾기 전(Step 진입 시) | 책을 발견한 후(verify 성공 시) |
| 무엇에 대한 콘텐츠인가 | Quest/Step 자체의 분위기·서사 | 특정 책 한 권의 소개 |
| 정답 정보인가 | 아니다 — 공개해도 안전 | 그렇다 — 인증 전 redaction 대상 |
| 연결 키 | (도서관 코드, 퀘스트 제목, step order) | ISBN |

실제 행동 지시("무엇을 찾아야 하는지")는 이 파일이 다루지 않고 항상 실제 `QuestStep.description`을 그대로 보여준다 — narrative는 그 앞을 감싸는 분위기일 뿐이다. quest/step identity는 재시드하면 바뀌는 cuid 대신 (도서관 코드, 퀘스트 제목, step order) 조합으로 연결한다(DEMO_GUIDE가 퀘스트를 항상 제목으로 안내하는 것과 같은 이유). 콘텐츠가 없는 Quest/Step은 generic fallback("새로운 탐사지역" / "이번에는 새로운 책 한 권을 발견해볼까요?")으로 대체되어 깨지지 않는다. 현재 대전 원신흥도서관의 3개 Quest × 3 Step(9개) 전체가 작성되어 있고, 그 외 도서관/Quest는 fallback을 사용한다.

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
- **모바일 touch tilt**: `pointerdown` 시점 위치로 즉시 한 번 기울인 뒤, 이후 `pointermove`를 계속 추적해 손가락 위치를 따라간다(각도 범위는 데스크톱보다 좁은 rotateX ±3deg / rotateY ±4deg). `pointerup/cancel`에서 원위치. `preventDefault()`/`setPointerCapture()`는 사용하지 않고 `touch-action: pan-y`만 유지한다 — 제스처가 세로 스크롤로 판단되면 브라우저가 자체적으로 `pointercancel`을 보내 추적이 멈추므로 스크롤을 절대 가로막지 않는다. (이전 버전은 `pointerdown` 시점에만 한 번 기울이고 `pointermove`는 추적하지 않았는데, 실기기에서 "손가락을 움직여도 책이 반응하지 않는다"는 문제로 이어져 continuous tracking으로 교체했다.)
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
