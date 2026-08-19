# data/

이 폴더는 대전 원신흥도서관(libCode `130026`) 실제 장서 데이터의 출처를 추적하기 위한 폴더다. Git에 커밋되어야 한다.

## 현재 상태 (완료)

- `snapshots/` — 2026-08-19에 `itemSrch` API로 수집한 원본 응답 10개 페이지(`itemSrch-130026-2026-06-01_2026-08-19-page*.json`, pageSize=30, 총 300건 raw). authKey는 응답 본문에 포함되지 않으므로 그대로 보존해도 안전함을 확인했다.
- `collected-books.json` — 위 300건 중 청구기호·서가위치 등 전 항목이 채워진 책 중에서 분류 다양성을 고려해 선별한 36권. ISBN13 중복 0건, 필수 필드 누락 0건.
- `quest-curation.json` — 위 36권을 전부 사용해 구성한 퀘스트 3개(각 3단계, 단계별 후보 4권, 실제 ISBN13만 참조). `prisma/seed.ts`는 여기서 참조하는 ISBN이 `collected-books.json`에 없거나, 단계별 후보가 3개 미만이거나, 중복 후보가 있으면 즉시 에러를 던진다.

## 다른 도서관으로 바꾸거나 재수집할 때

### 0) libCode 확인 (필수)

libCode를 추측하지 않는다. 아래로 실제 값을 조회해 도서관명/주소로 직접 확인한다 (libSrch의 `keyword` 파라미터는 서버에서 필터링되지 않으므로 스크립트가 전체 목록을 받아 클라이언트에서 필터링한다).

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run lookup:library -- --keyword=도서관명
```

확인된 libCode를 `src/lib/config.ts`의 `LIBRARY_CODE`에 반영한다.

### 1) 도서 수집

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run fetch:books -- --libCode=확인된실제코드 --startDt=2026-06-01 --endDt=2026-08-19
```

실측 기준 `itemSrch`는 `pageSize>=100`에서 504 Timeout이 발생해 스크립트 기본값을 `pageSize=30`으로 낮췄다(`--maxPages`로 페이지 수 조절 가능). 실행 후 `collected-books.json`을 열어 실제로 어떤 책이 수집되었는지 확인하고, 그 중 퀘스트에 쓸 책을 골라 `quest-curation.json`을 작성한다. 형식은 `prisma/seed.ts`의 `CurationFile` 타입을 참고한다.
