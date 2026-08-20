// "읽어보고 싶어요" 관심 표시 저장소.
//
// discovery-storage.ts(발견 도감)와는 별도의 concept이자 별도의 localStorage 키로 분리한다.
// 발견은 "책을 찾아냈다"는 사실이고, 관심은 "그 책을 읽고 싶다"는 사용자의 의사이기 때문에
// 하나의 레코드에 `interested: boolean`을 얹기보다 독립된 저장소로 두는 편이 각각의 의미를
// 유지하기 쉽고, 향후 관심 관련 기능(예: 관심 목록 공유)이 발견 로직과 얽히지 않는다.
//
// 이번 MVP는 서버 인증이 없으므로 "발견한 책만 관심 표시 가능"이라는 규칙은 UI(호출하는 쪽)에서
// 강제한다 — 이 파일 자체는 임의 bookId 저장을 막지 않는다(개발자도구로 임의 조작해도 노출되는
// 정보가 없으므로 보안상 문제는 아니다).

const STORAGE_KEY = "libquest_interests";
const CURRENT_VERSION = 1;

export type InterestStore = {
  version: number;
  bookIds: string[];
};

const EMPTY_STORE: InterestStore = { version: CURRENT_VERSION, bookIds: [] };

export function loadInterestStore(): InterestStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<InterestStore>;
    if (parsed.version !== CURRENT_VERSION || !Array.isArray(parsed.bookIds)) return EMPTY_STORE;
    return { version: CURRENT_VERSION, bookIds: parsed.bookIds.filter((id) => typeof id === "string") };
  } catch {
    return EMPTY_STORE;
  }
}

function saveInterestStore(store: InterestStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function isInterested(store: InterestStore, bookId: string): boolean {
  return store.bookIds.includes(bookId);
}

/** 관심 표시를 켜고 끈다(토글). 결과 상태를 반환한다. */
export function toggleInterest(bookId: string): { store: InterestStore; interested: boolean } {
  const store = loadInterestStore();
  const already = store.bookIds.includes(bookId);
  const next: InterestStore = already
    ? { version: CURRENT_VERSION, bookIds: store.bookIds.filter((id) => id !== bookId) }
    : { version: CURRENT_VERSION, bookIds: [...store.bookIds, bookId] };
  saveInterestStore(next);
  return { store: next, interested: !already };
}
