// 책 발견 후 보여주는 편집 콘텐츠(teaser/hook/question) 조회.
//
// Data4Library itemSrch 응답에는 줄거리/키워드 필드가 없어(covers.ts와 같은 이유),
// 이 콘텐츠는 Lib Quest가 실제 제목·부제·저자·KDC 분류만 근거로 직접 작성한 편집 초안이다.
// 각 도서관 폴더의 book-editorial.json에 ISBN 기준으로 저장하며, 아직 작성하지 않은 책은
// null을 반환한다(빈 콘텐츠를 억지로 채우지 않는다).
import editorial130026 from "../../data/libraries/130026/book-editorial.json";

export type BookEditorial = {
  teaser: string;
  hook: string;
  question: string;
};

type EditorialFile = { books: Record<string, BookEditorial> };

const BY_LIBRARY: Record<string, EditorialFile> = {
  "130026": editorial130026 as EditorialFile,
};

export function getEditorial(libraryCode: string, isbn13: string): BookEditorial | null {
  return BY_LIBRARY[libraryCode]?.books[isbn13] ?? null;
}
