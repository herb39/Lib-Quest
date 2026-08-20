# data/

이 폴더는 서비스가 지원하는 대전 지역 도서관 4곳의 실제 장서 데이터 출처를 추적하기 위한 폴더다. Git에 커밋되어야 한다.

## 구조

```
data/
  snapshots/                    도서관 구분 없이 한 폴더에 모아둔다 (파일명에 libCode가 포함됨)
  libraries/
    130026/                     대전 원신흥도서관 (대표 시연)
      collected-books.json
      quest-curation.json
      book-editorial.json        teaser/hook/question (36권 전체 작성)
    125004/                     대전 갈마도서관
      collected-books.json
      quest-curation.json
    125010/                     대전 가수원도서관
      collected-books.json
      quest-curation.json
    130012/                     대전 노은도서관
      collected-books.json
      quest-curation.json
```

`libCode`가 폴더명이자 도서관-데이터 매핑의 기준이다. `prisma/seed.ts`는 `data/libraries/` 아래의 폴더를 전부 순회하며 각각을 하나의 `Library`로 시드한다.

- `collected-books.json` — 해당 도서관에서 `itemSrch`로 수집한 원본 중, 청구기호·서가위치 등 전 항목이 채워진 책만 골라 분류 다양성을 고려해 선별한 서브셋(도서관마다 36권). ISBN13 중복 0건, 필수 필드 누락 0건.
- `quest-curation.json` — 그 36권을 전부 사용해 구성한 퀘스트 3개(각 3단계, 단계별 후보 4권, 실제 ISBN13만 참조). `prisma/seed.ts`는 여기서 참조하는 ISBN이 같은 폴더의 `collected-books.json`에 없거나, 단계별 후보가 3개 미만이거나, 중복 후보가 있으면 즉시 에러를 던진다.
- `snapshots/` — 각 도서관의 `itemSrch` 원본 응답(파일명에 `itemSrch-<libCode>-...`로 도서관이 구분됨). authKey는 응답 본문에 포함되지 않으므로 그대로 보존해도 안전함을 확인했다.
- `book-editorial.json`(원신흥만 존재) — 발견 성공 화면에서 보여주는 teaser/hook/question. **Data4Library 데이터가 아니라 Lib Quest가 직접 작성한 편집 콘텐츠**다. `src/lib/editorial.ts`가 ISBN 기준으로 조회한다. 아래 "book-editorial.json 작성 방식" 참고.

### 표지 이미지 (src/lib/cover-urls.json)

`data/` 폴더 밖에 있지만 이 데이터를 그대로 가공한 파일이라 여기에 함께 기록한다. `data/snapshots/*.json`의 `bookImageURL` 필드를 ISBN 기준으로 추출해 `src/lib/cover-urls.json`(144권 중 139권 매칭, 호스트는 `image.aladin.co.kr` 122건·`shopping-phinf.pstatic.net` 17건)에 저장했다. `src/lib/covers.ts`의 `getCoverUrl(isbn13)`이 조회한다. ISBN 패턴으로 URL을 추측하거나 임의 생성한 값은 없다. 로딩/재시도 전략은 [DEVELOPMENT.md](../docs/DEVELOPMENT.md)의 "표지 이미지" 참고.

### book-editorial.json 작성 방식

| 구분 | 내용 |
| --- | --- |
| 출처 | Lib Quest 자체 제작(편집 초안). Data4Library `itemSrch`는 줄거리/키워드 필드를 제공하지 않는다(`bookname`/`authors`/`class_no`/`class_nm`/`bookImageURL` 등 서지 메타데이터만 존재, 실제로 raw snapshot 필드를 전수 확인함). |
| 생성 방식 | 실제 제목·부제·저자·KDC 분류만 근거로 작성. 소설(KDC 813.7/833.6/843.6)은 부제에 줄거리 정보가 없어 장르·작가 계열 소개 수준으로 제한했고, 그 외 분야(사회과학/자연과학/예술/철학/역사/기술과학)는 실제 부제 문구가 사실상 요약이라 이를 참고해 문장을 다듬었다. 존재하지 않는 사건·인물·추천사·실제 인물 인용은 만들지 않았다. |
| 검수 방식 | 작성 직후 실제 UI(발견 성공 화면·`/admin/review` 콘텐츠 패널)에서 문구가 책 제목/분류와 명백히 어긋나지 않는지 직접 확인. |
| ISBN 연결 방식 | `isbn13` 키로 연결(제목 문자열 매칭 금지 — 동명이서 오매칭 방지). `src/lib/editorial.ts`의 `getEditorial(libraryCode, isbn13)`이 조회한다. |
| Data4Library 데이터 vs Lib Quest 콘텐츠 | `collected-books.json`/`quest-curation.json`(청구기호·서가위치·ISBN 등)은 Data4Library 원본 그대로이고, `book-editorial.json`(teaser/hook/question)은 Lib Quest가 만든 콘텐츠라는 점을 명확히 구분한다. `/admin/review`에서도 두 출처가 다른 영역(표 vs "콘텐츠 보기" 패널)에 분리 표시된다. |
| 현재 적용 범위 | 대전 원신흥도서관 36권 전체. 나머지 3개 도서관(갈마·가수원·노은) 108권은 아직 작성하지 않았다 — 근거 없는 문구를 시간에 쫓겨 만드는 대신 품질을 우선했다. `/admin/review`에서 `콘텐츠 없음`으로 표시되며, 이용자 화면에서는 해당 콘텐츠 영역 자체가 노출되지 않는다(표지·제목·저자·XP는 정상 노출). |

## 도서관별 실제 수집 이력 (2026-08-19)

| libCode | 도서관 | 수집 기간 | 원본 건수 | 비고 |
| --- | --- | --- | --- | --- |
| 130026 | 대전 원신흥도서관 | 2026-06-01~2026-08-19 | 300건 | 필드 누락 0건, 3개 국가 문학으로 Quest1 구성 |
| 125004 | 대전 갈마도서관 | 2026-06-01~2026-08-19 | 300건 | 필드 누락 0건 |
| 125010 | 대전 가수원도서관 | 2025-01-01~2026-08-19 | 450건 | 최근 등록분에 성인 일본소설 재고가 없어 Quest1 3단계를 한국소설/영미소설/한국에세이로 조정 |
| 130012 | 대전 노은도서관 | 2025-01-01~2026-08-19 | 445건 | 필드 누락 0건, 전 분야 재고 풍부 |

가수원도서관을 제외한 3곳은 표준 템플릿(한국소설/일본소설/영미소설 등)을 그대로 적용했다. 가수원도서관은 최근 등록 데이터에 성인 일본소설이 전혀 없어(실제 장서 분포이므로 억지로 만들지 않음) Quest1의 3단계 구성만 실제 재고에 맞게 조정했다 — 상세 사유는 `data/libraries/125010/collected-books.json`의 `note` 필드 참고.

### 검토했으나 제외한 도서관

데이터 품질(청구기호/서가위치 필드 완전성, KDC 분류 다양성) 기준으로 아래 도서관들을 검토했으나 채택하지 않았다.

| libCode | 도서관 | 제외 사유 |
| --- | --- | --- |
| 130009 | 홍도도서관 | 300건 중 157건 classNo 누락, 271건 shelfLocation 누락 |
| 125006 | 용운도서관 | 450건 중 완전한 레코드 69건뿐이며 역사(0)·일본문학(1)·예술(2) 분야가 극히 부족 |
| 125005 | 안산도서관 | shelfLocation 대부분 공란 |
| 130030 | 석봉도서관 | classNo/shelfLocation 100% 공란 |
| 130013 | 송촌도서관 | shelfLocation 53% 누락 |
| 125003 | 한밭도서관 | shelfLocation 필드가 항상 공란(대표도서관 특성상 배가식 서가 미표기로 추정) |
| 130028 | 월평도서관 | API가 지속적으로 504 Timeout 반환 (재시도 실패) |
| 130008 | 자양도서관 | API가 지속적으로 timeout 발생 |

## 다른 도서관을 추가하거나 재수집할 때

### 0) libCode 확인 (필수)

libCode를 추측하지 않는다. 아래로 실제 값을 조회해 도서관명/주소로 직접 확인한다 (libSrch의 `keyword` 파라미터는 서버에서 필터링되지 않으므로 스크립트가 전체 목록을 받아 클라이언트에서 필터링한다).

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run lookup:library -- --keyword=도서관명
```

확인된 libCode를 `src/lib/config.ts`의 `LIBRARIES` 배열에 `{code, name, region}` 형태로 추가한다.

### 1) 도서 수집

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run fetch:books -- --libCode=확인된실제코드 --startDt=2026-06-01 --endDt=2026-08-19
```

결과는 `data/libraries/<libCode>/collected-books.json`에 저장된다. 실측 기준 `itemSrch`는 `pageSize>=100`에서 504 Timeout이 발생해 스크립트 기본값을 `pageSize=30`으로 낮췄다(`--maxPages`로 페이지 수 조절 가능). 최근 등록분만으로 특정 분야(예: 일본소설, 역사, 예술) 재고가 부족하면 `--startDt`를 더 과거로 넓혀 재실행한다. 그래도 특정 분야 재고가 없으면 그 분야를 억지로 채우지 말고 실제 있는 분야로 퀘스트 구성을 조정한다.

### 2) 큐레이션

`collected-books.json`을 열어 실제로 어떤 책이 수집되었는지 확인하고, 그 중 퀘스트에 쓸 책을 골라 같은 폴더에 `quest-curation.json`을 작성한다. 형식은 `prisma/seed.ts`의 `CurationFile` 타입을 참고한다.

### 3) 시드

```bash
npm run db:seed
```

`data/libraries/` 아래 모든 폴더를 순회하며 시드한다. 이미 존재하는 도서관/퀘스트는 다시 만들지 않으므로(재실행 안전), 새 도서관 폴더만 추가해도 기존 도서관 데이터가 훼손되지 않는다.
