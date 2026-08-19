# Lib Quest

2026 도서관 데이터 활용 공모전 발표심사용 모바일 웹 프로토타입.
도서관 실제 소장 도서를 기반으로 서가를 탐색하고 ISBN을 확인하며 퀘스트를 완료하는 서비스.

대표 도서관: 대전 원신흥도서관 (libCode `130026`, Data4Library `libSrch`로 확인)

- GitHub: https://github.com/herb39/Lib-Quest
- 배포 도메인: https://quest.lib.lc (Vercel Hobby)
- DB: Neon PostgreSQL (Free)

## 현재 상태

- Next.js 16(App Router) + TypeScript + Tailwind CSS
- Prisma 7 + PostgreSQL(Neon), `@prisma/adapter-pg` 드라이버 어댑터 방식
- 데이터 모델: `Library`, `Book`, `Quest`, `QuestStep`, `QuestCandidate`, `QuestSession` ([prisma/schema.prisma](prisma/schema.prisma))
- 초기 마이그레이션 생성 완료 ([prisma/migrations](prisma/migrations)) — 라이브 DB 연결 없이 `prisma migrate diff`로 생성
- `/quests`, `/quests/[id]`는 **Prisma로 실조회**한다 ([src/lib/data.ts](src/lib/data.ts)). `DATABASE_URL`이 없을 때만 데모 데이터로 자동 대체된다.
- ISBN 판정은 서버 API에서 규칙 기반으로 수행한다 (`POST /api/quests/[questId]/steps/[stepId]/verify`, [route.ts](src/app/api/quests/%5BquestId%5D/steps/%5BstepId%5D/verify/route.ts)). 클라이언트는 판정 로직을 갖지 않는다.
- 진행 상태(QuestSession)는 익명 `localStorage` 세션으로 유지한다. (선택 근거는 아래 "QuestSession 설계" 참고)
- 실제 장서 데이터 수집 스크립트: [scripts/fetch-library-books.ts](scripts/fetch-library-books.ts) — Data4Library `itemSrch` API 호출, 정규화, 원본 스냅샷 보관
- 운영자 검수 화면 `/admin/review`, 데이터 출처 화면 `/data-source` (읽기 전용, 로그인/CRUD 없음)
- Neon 마이그레이션 적용 + 실데이터 시드 완료, Vercel + Cloudflare(`quest.lib.lc`)로 배포 완료

## ⚠️ 데이터 출처 관련 중요 사항

**실제 Data4Library 데이터 수집이 완료되었다.** [data/collected-books.json](data/collected-books.json)에 대전 원신흥도서관(libCode `130026`)에서 실제 `itemSrch` API로 수집한 36권이 들어 있고, [data/quest-curation.json](data/quest-curation.json)에 그 중 ISBN만 참조하는 퀘스트 3개(각 3단계, 단계별 후보 4권)가 정의되어 있다. 자세한 수집 과정은 [data/README.md](data/README.md) 참고.

`prisma/seed.ts`는 `data/collected-books.json`이 없으면 실행되지 않는다. 즉 실제 API로 수집한 데이터가 없는 상태에서는 DB에 어떤 도서도 들어가지 않는다 (가짜 데이터를 절대 만들지 않기 위함). 큐레이션이 존재하지 않는 ISBN을 참조하거나 candidate가 3개 미만/중복이면 seed가 즉시 실패한다.

로컬에서 DB 없이 화면 흐름만 보고 싶을 때는 `DATABASE_URL`을 비워두면 [src/lib/mock-data.ts](src/lib/mock-data.ts)의 데모 데이터(실제 API 데이터 아님, 화면 표시에 "데모 데이터" 배너 표시됨)로 자동 대체된다.

## 실행 방법 (로컬, DB 없이 화면만 확인)

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속. `DATABASE_URL`을 비워두면 데모 데이터로 전체 흐름(퀘스트 선택 → 3단계 → 결과 카드)을 확인할 수 있다.

## 실제 데이터 수집 → Neon 반영 절차

아래 1~3단계(libCode 확인, 도서 수집, 큐레이션)는 이미 완료되어 `data/`에 결과물이 있다. 재수집하거나 다른 도서관으로 바꿀 때만 다시 실행하면 된다. 지금 당장 필요한 건 4단계(Neon 반영)뿐이다.

### 1) Data4Library API 키 발급 + libCode 확인

https://data4library.kr 에서 `authKey`를 발급받는다.

**libCode는 절대 추측/하드코딩하지 않는다.** 아래 스크립트로 실제 값을 조회해 결과 목록에서 "대전광역시 유성구 원신흥도서관"이 맞는지 도서관명/주소로 직접 확인한 뒤, 확인된 값만 [src/lib/config.ts](src/lib/config.ts)의 `LIBRARY_CODE`에 반영한다.

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run lookup:library -- --keyword=원신흥도서관
```

### 2) 실제 도서 수집

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run fetch:books -- --libCode=확인된실제코드 --startDt=2026-01-01 --endDt=2026-08-19
```

- 원본 API 응답: `data/snapshots/`
- 정규화된 도서 목록: `data/collected-books.json` (ISBN13 없는 항목 제외, 중복 제거)
- 수집된 도서가 30권 미만이면 콘솔에 경고가 출력된다. 이때는 `startDt`를 앞으로 당겨 기간을 넓혀 재실행한다. **가짜 데이터로 채우지 않는다.**
- 문학/인문사회/과학·예술 등 분류가 고르게 섞이도록 기간을 나눠 여러 번 수집해도 된다 (같은 `collected-books.json`에 누적하려면 스크립트 재실행 전 결과를 병합하는 절차가 아직 없으므로, 현재는 한 번의 넓은 기간으로 수집하는 것을 권장한다).

### 3) 퀘스트 큐레이션 (사람이 직접 작성)

`data/collected-books.json`을 열어 실제로 어떤 책이 있는지 확인한 뒤, 그 중 ISBN13만 참조해서 `data/quest-curation.json`을 작성한다. 형식은 [prisma/seed.ts](prisma/seed.ts)의 `CurationFile` 타입 참고. 이 단계 전까지는 DB에 `Book`만 있고 `Quest`는 생성되지 않는다.

### 4) Neon에 반영

```bash
# .env 에 Neon DATABASE_URL 설정 후
npx prisma generate
npx prisma migrate deploy   # 이미 생성된 초기 마이그레이션을 적용 (destructive 아님)
npm run db:seed             # data/collected-books.json + data/quest-curation.json 시드
```

`prisma migrate deploy`는 존재하는 마이그레이션 파일만 순서대로 적용하며 스키마를 자동으로 새로 생성/추론하지 않는다. Production DB에 대해 자동으로 destructive migration을 실행하는 스크립트는 두지 않았다.

## itemSrch 관련 주의

`itemSrch`는 **등록 기간(startDt~endDt) 기준 조회**이며 실시간 대출 가능 여부가 아니다. 이 프로젝트는 `registeredAt`(등록일)으로만 사용하며, 화면 어디에도 "지금 대출 가능"처럼 표현하지 않는다.

## QuestSession 설계: localStorage + 서버 ISBN 검증 (B안 채택)

검토한 두 안:

- A. 서버 anonymous session (세션 생성/조회 API, 서버 상태 저장)
- B. localStorage 진행 상태 + 서버 ISBN 검증 API (판정만 서버, 진행 상태는 클라이언트)

**B안을 채택했다.** 이유:

- 8/26 발표 제출까지 시간이 촉박해 세션 생성/만료/충돌 처리 같은 부가 로직을 새로 만들 여유가 없다.
- 발표 시연은 보통 한 기기에서 진행되므로 로그인 없는 로컬 진행 상태로 충분하다.
- 판정 로직만 서버로 옮기면 "AI/클라이언트가 정답을 판정하지 않는다"는 핵심 원칙은 그대로 지킬 수 있다.
- 서버 세션을 붙이면 생성 실패, 만료, 여러 기기 충돌 등 시연 중 장애 가능성이 늘어난다. 로컬 상태는 이런 실패 지점이 없다.
- `QuestSession` 모델은 스키마에 남겨두어 추후 필요해지면 확장한다 (지금은 사용하지 않음).

## Production mock fallback 정책

`src/lib/data.ts`는 `DATABASE_URL`이 **설정되어 있지 않을 때만** 데모 데이터를 반환한다. `DATABASE_URL`이 설정된 상태에서 Prisma 쿼리가 실패하면(연결 실패, 인증 실패 등) 그 에러를 그대로 던지며, 데모 데이터로 조용히 대체하지 않는다 — Next.js가 기본 에러 화면을 표시한다.

즉:

- 로컬 개발(환경변수 없음): 데모 데이터 fallback 허용, 화면에 배너로 명시
- Production(Vercel, `DATABASE_URL` 설정됨): DB 연결 실패 시 오류 화면 표시. mock으로 자동 전환되지 않는다.

Vercel에 `DATABASE_URL`을 등록하는 순간부터 이 정책이 적용되므로 별도 조치가 필요 없다.

## Vercel 배포 (완료, 정보 기록용)

1. GitHub `herb39/Lib-Quest`를 Vercel 프로젝트로 Import (Framework: Next.js 자동 인식)
2. 프로젝트 환경변수에 `DATABASE_URL`만 등록한다 (Neon pooled connection string)
   - `DATA4LIBRARY_API_KEY`는 **등록하지 않는다**. 데이터는 사전 수집 방식이라 런타임에 필요 없다.
3. Neon DB에 대해 로컬에서 `npx prisma migrate deploy`와 `npm run db:seed`를 먼저 실행해 실제 데이터를 반영한 뒤 배포한다.
4. 빌드 명령은 기본값(`next build`) 그대로 사용, `postinstall`에서 `prisma generate`가 자동 실행된다.
5. Custom Domain에 `quest.lib.lc` 추가 → Vercel이 요구하는 CNAME 대상 확인 (Vercel 대시보드 Domains 화면에 표시됨, 보통 `cname.vercel-dns.com`)

## Cloudflare DNS 설정 (lib.lc) — 완료, 정보 기록용

- Cloudflare에서 관리 중인 `lib.lc` 존은 그대로 유지한다.
- `quest` 서브도메인에 대해 CNAME 레코드 추가:
  - Type: `CNAME`
  - Name: `quest`
  - Target: Vercel이 제시하는 CNAME 값 (Vercel Domains 설정 화면 확인)
  - Proxy status: **DNS only (회색 구름)** — Vercel의 자동 HTTPS 인증서 발급이 Cloudflare 프록시와 충돌하지 않도록 우선 DNS only로 구성한다.
- 유료 Cloudflare 기능(WAF 룰, Workers 등)은 사용하지 않는다.
- 이전에 사용하던 `lib-quest.lib.lc`(Vercel/Cloudflare 설정)는 삭제되었다. 공식 production URL은 `https://quest.lib.lc` 하나다.

## 필요한 환경 변수

| 변수 | 필요 시점 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | 로컬 DB 연결 시 / Vercel 운영 | Neon PostgreSQL 연결 문자열. 비어 있으면 데모 데이터로 자동 대체 |
| `DATA4LIBRARY_API_KEY` | 로컬 데이터 수집 시에만 | `scripts/fetch-library-books.ts` 실행에만 필요. **Vercel에는 등록하지 않는다** |

`.env.example` 참고. API 키는 절대 커밋하지 않는다 (`.env*`는 `.gitignore`에 포함됨).

## 아직 미구현인 항목

- 없음 (발표용 MVP 필수 화면·배포는 모두 완료). 이후 확장은 "다음 작업" 참고.

## 다음 작업

1. `https://quest.lib.lc`, `/quests`, `/admin/review`, `/data-source`를 실제 모바일 기기로 최종 리허설
2. 발표 직전 Neon(Free) 컴퓨트가 슬립되어 있지 않은지 미리 한 번 접속해 확인
3. 발표 이후 필요 시 다른 도서관/퀘스트 확장 (현재는 단일 도서관·퀘스트 3개로 의도적으로 한정)

## 기술 스택

Next.js · React · TypeScript · App Router · Tailwind CSS · PostgreSQL · Prisma · Neon · Vercel
