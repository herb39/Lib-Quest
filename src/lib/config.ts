// 대표 도서관 식별자. 이번 MVP는 단일 도서관만 지원한다.
//
// libCode 130026은 scripts/lookup-library.ts (Data4Library libSrch API)로 확인했다.
// 검색 결과 전국에서 도서관명이 "원신흥도서관"인 항목은 1건뿐이며, 주소가
// "대전광역시 유성구 원신흥남로 59", 홈페이지가 대전 유성구 도서관 사이트(lib.yuseong.go.kr)로
// 대전광역시 유성구 원신흥도서관임을 확인했다.
export const LIBRARY_CODE = "130026";
export const LIBRARY_NAME = "대전 원신흥도서관";
