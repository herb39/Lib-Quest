// Quest 완료 후 "오늘의 한 권" 선택 기록.
//
// Quest 진행 상태(QuestRunner의 QuestSession)와도, 발견 도감(discovery-storage)과도 분리된
// 별도 개념이다 — "이 Quest에서 어떤 책을 오늘 읽기로 골랐는지"만 남긴다. 실제 대출 여부와는
// 무관하며(현재 시스템은 대출 여부를 알 수 없다), 향후 이벤트 통계(예: final_book_selected)와
// 연결하기 쉽도록 questId/bookId/selectedAt 최소 구조만 저장한다.

const STORAGE_KEY = "libquest_final_selections";
const CURRENT_VERSION = 1;

export type FinalSelection = {
  questId: string;
  bookId: string;
  selectedAt: string;
};

type FinalSelectionStore = {
  version: number;
  selections: FinalSelection[];
};

const EMPTY_STORE: FinalSelectionStore = { version: CURRENT_VERSION, selections: [] };

function loadStore(): FinalSelectionStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<FinalSelectionStore>;
    if (parsed.version !== CURRENT_VERSION || !Array.isArray(parsed.selections)) return EMPTY_STORE;
    return { version: CURRENT_VERSION, selections: parsed.selections };
  } catch {
    return EMPTY_STORE;
  }
}

function saveStore(store: FinalSelectionStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** 같은 Quest를 다시 완료하면 이전 선택을 새 선택으로 덮어쓴다(퀘스트당 최신 선택 1건). */
export function saveFinalSelection(questId: string, bookId: string): FinalSelection {
  const store = loadStore();
  const entry: FinalSelection = { questId, bookId, selectedAt: new Date().toISOString() };
  const next: FinalSelectionStore = {
    version: CURRENT_VERSION,
    selections: [...store.selections.filter((s) => s.questId !== questId), entry],
  };
  saveStore(next);
  return entry;
}

export function getFinalSelection(questId: string): FinalSelection | null {
  return loadStore().selections.find((s) => s.questId === questId) ?? null;
}
