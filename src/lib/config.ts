// 서비스가 지원하는 도서관 목록. 각 libCode는 scripts/lookup-library.ts (Data4Library
// libSrch API)로 실제 조회해 확인한 값만 사용한다 (추측/하드코딩 금지).
//
// region은 화면 표시(카드의 지역 정보)용으로만 쓰는 값이며, libSrch 응답의 실제 주소를
// 요약한 것이다. DB(Library 모델)에는 code/name만 저장하고, region은 여기 정적 메타데이터로만 둔다.
export type LibraryMeta = {
  code: string;
  name: string;
  region: string;
  /** 발표 대표 시연 도서관 여부. 화면에 "대표 시연" 배지를 붙이는 용도일 뿐 추천을 의미하지 않는다. */
  isFeatured?: boolean;
};

export const LIBRARIES: LibraryMeta[] = [
  {
    code: "130026",
    name: "대전 원신흥도서관",
    region: "대전광역시 유성구",
    isFeatured: true,
  },
  {
    code: "125004",
    name: "대전 갈마도서관",
    region: "대전광역시 서구",
  },
  {
    code: "125010",
    name: "대전 가수원도서관",
    region: "대전광역시 서구",
  },
  {
    code: "130012",
    name: "대전 노은도서관",
    region: "대전광역시 유성구",
  },
];

/** 대표 발표 시연 도서관. DATABASE_URL 없이 데모 데이터를 보여줄 때의 기본값이자, /quests에 library 파라미터가 없을 때의 기본 도서관. */
export const DEFAULT_LIBRARY_CODE = "130026";
export const DEFAULT_LIBRARY_NAME = "대전 원신흥도서관";

export function getLibraryMeta(code: string): LibraryMeta | undefined {
  return LIBRARIES.find((l) => l.code === code);
}
