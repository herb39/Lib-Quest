// 대표 도서관 식별자. 이번 MVP는 단일 도서관만 지원한다.
//
// ⚠️ LIBRARY_CODE는 아직 확인되지 않았다 (TODO).
// 대전 원신흥도서관으로 대표 도서관을 변경했지만, DATA4LIBRARY_API_KEY가 없어
// scripts/lookup-library.ts로 실제 libCode를 조회하지 못했다.
// 절대 libCode를 추측해서 채우지 말고, 아래 명령으로 확인된 값만 반영할 것:
//   DATA4LIBRARY_API_KEY=발급받은키 npx tsx scripts/lookup-library.ts --keyword=원신흥도서관
export const LIBRARY_CODE = "";
export const LIBRARY_NAME = "대전 원신흥도서관";
