# data/

이 폴더는 청주가로수도서관 실제 장서 데이터의 출처를 추적하기 위한 폴더다. Git에 커밋되어야 한다.

- `snapshots/` — `scripts/fetch-library-books.ts` 실행 시 Data4Library `itemSrch` API의 **원본 응답**을 그대로 저장한 파일들. 나중에 "이 책이 정말 API에서 확인된 데이터인지" 검증할 때 사용한다.
- `collected-books.json` — 원본 응답에서 ISBN13 기준으로 정규화·중복 제거한 도서 목록. `prisma/seed.ts`가 이 파일만 읽어서 `Book` 테이블을 채운다.
- `quest-curation.json` — `collected-books.json`에 실제로 존재하는 ISBN13만 참조해 퀘스트/단계/후보 도서를 구성한 파일 (사람이 직접 작성). 아직 작성되지 않았다면 `prisma/seed.ts`는 도서만 채우고 퀘스트는 만들지 않는다.

## 생성 방법

```bash
DATA4LIBRARY_API_KEY=발급받은키 npm run fetch:books -- --libCode=143136 --startDt=2026-01-01 --endDt=2026-08-19
```

실행 후 `collected-books.json`을 열어 실제로 어떤 책이 수집되었는지 확인하고, 그 중 퀘스트에 쓸 책을 골라 `quest-curation.json`을 작성한다. 형식은 `prisma/seed.ts`의 `CurationFile` 타입을 참고한다.
