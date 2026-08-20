// "지금까지 실제로 발견한 책" 저장소 (도감).
//
// P0-1의 QuestSession(localStorage `libquest_session_<questId>`)은 "현재 Quest 진행 상태"만
// 다루는 임시 상태다. 이 파일은 그와 완전히 분리된 "발견 도감" 데이터를 다룬다 — Quest를
// 다시 시작해도 도감은 유지되고, 도감을 초기화해도 진행 중인 Quest는 그대로 이어진다.
//
// MVP이므로 서버 DB가 아닌 localStorage에 저장하며, 후보 목록 전체나 ISBN 같은 불필요한
// 정보는 저장하지 않고 "발견 성공 시 verify API가 돌려준 최소 정보"만 스냅샷으로 남긴다.

const STORAGE_KEY = "libquest_discoveries";
const CURRENT_VERSION = 1;

export type Discovery = {
  bookId: string;
  libraryCode: string;
  questId: string;
  stepId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  className: string | null;
  discoveredAt: string;
};

export type DiscoveryStore = {
  version: number;
  discoveries: Discovery[];
};

const EMPTY_STORE: DiscoveryStore = { version: CURRENT_VERSION, discoveries: [] };

function isDiscovery(value: unknown): value is Discovery {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.bookId === "string" &&
    typeof v.libraryCode === "string" &&
    typeof v.questId === "string" &&
    typeof v.stepId === "string" &&
    typeof v.title === "string" &&
    typeof v.discoveredAt === "string"
  );
}

/** localStorage에서 도감을 읽는다. 손상되었거나 버전이 다르면 빈 도감으로 대체한다(throw하지 않음). */
export function loadDiscoveryStore(): DiscoveryStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<DiscoveryStore>;
    if (parsed.version !== CURRENT_VERSION || !Array.isArray(parsed.discoveries)) {
      return EMPTY_STORE;
    }
    return { version: CURRENT_VERSION, discoveries: parsed.discoveries.filter(isDiscovery) };
  } catch {
    return EMPTY_STORE;
  }
}

function saveDiscoveryStore(store: DiscoveryStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * 발견을 도감에 기록한다. 같은 bookId가 이미 있으면(재도전 등) 새로 추가하지 않고
 * isNew: false만 반환한다 — 도감의 unique 발견 수/XP는 늘지 않는다.
 */
export function recordDiscovery(entry: Discovery): { store: DiscoveryStore; isNew: boolean } {
  const store = loadDiscoveryStore();
  const alreadyFound = store.discoveries.some((d) => d.bookId === entry.bookId);
  if (alreadyFound) {
    return { store, isNew: false };
  }
  const next: DiscoveryStore = { version: CURRENT_VERSION, discoveries: [...store.discoveries, entry] };
  saveDiscoveryStore(next);
  return { store: next, isNew: true };
}

export function resetDiscoveryStore(): DiscoveryStore {
  saveDiscoveryStore(EMPTY_STORE);
  return EMPTY_STORE;
}

export function getUniqueDiscoveryCount(store: DiscoveryStore): number {
  return store.discoveries.length; // bookId 중복은 recordDiscovery에서 이미 걸러진다
}

/** 도감 unique 발견 수 × 10 으로 XP를 계산한다 (별도 mutable XP 값을 저장하지 않아 데이터 불일치를 줄인다). */
export function getXp(store: DiscoveryStore): number {
  return getUniqueDiscoveryCount(store) * 10;
}

const EXPLORER_TITLES: { min: number; title: string }[] = [
  { min: 0, title: "첫 방문자" },
  { min: 50, title: "책장 산책자" },
  { min: 150, title: "서가 탐험가" },
  { min: 300, title: "장르 여행자" },
  { min: 600, title: "도서관 탐험가" },
];

/** XP 기준 deterministic 칭호. DB에 저장하지 않고 항상 XP에서 계산한다. */
export function getExplorerTitle(xp: number): string {
  let current = EXPLORER_TITLES[0].title;
  for (const tier of EXPLORER_TITLES) {
    if (xp >= tier.min) current = tier.title;
  }
  return current;
}

export function getLibraryDiscoveryCount(store: DiscoveryStore, libraryCode: string): number {
  return store.discoveries.filter((d) => d.libraryCode === libraryCode).length;
}
