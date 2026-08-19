// ⚠️ DEMO/개발 전용 fallback 데이터.
//
// 여기 있는 책 정보(청구기호/서가 위치/등록일 등)는 실제 도서관정보나루(Data4Library) API 응답이 아니다.
// DB(DATABASE_URL)가 설정되지 않은 로컬 환경에서 화면 흐름만 확인할 수 있도록 만든 임시 데이터이며,
// 발표/운영에서는 절대 사용하지 않는다. 실제 데이터는 scripts/fetch-library-books.ts 로 수집한 뒤
// prisma/seed.ts 로 Neon DB에 저장하고, 화면은 항상 DB(src/lib/data.ts)를 우선 사용한다.
import type { QuestSummary, BookSummary } from "@/lib/types";

export const LIBRARY = {
  code: "143136",
  name: "청주가로수도서관",
};

function book(
  isbn13: string,
  title: string,
  author: string,
  callNumber: string,
  shelfLocation: string
): BookSummary {
  return { id: isbn13, isbn13, title, author, callNumber, shelfLocation };
}

const 채식주의자 = book("9788936434120", "채식주의자", "한강", "813.7-한15ㅊ", "종합자료실 2층");
const 소년이온다 = book("9788936433598", "소년이 온다", "한강", "813.7-한15ㅅ", "종합자료실 2층");
const 흰 = book("9788936434175", "흰", "한강", "813.7-한15흰", "종합자료실 2층");
const 김지영 = book("9788954672178", "82년생 김지영", "조남주", "813.7-조67ㅍ", "종합자료실 2층");
const 달러구트 = book("9791165341909", "달러구트 꿈 백화점", "이미예", "813.7-이67ㄷ", "종합자료실 2층");
const 온실 = book("9791165342111", "지구 끝의 온실", "김초엽", "813.7-김23ㅈ", "종합자료실 2층");
const 빛의속도 = book("9791165341084", "우리가 빛의 속도로 갈 수 없다면", "김초엽", "813.7-김23ㅇ", "종합자료실 2층");

export const DEMO_QUESTS: QuestSummary[] = [
  {
    id: "korean-novel-quest",
    title: "한국 소설 탐험",
    description: "종합자료실 2층 서가에서 한국 소설 세 권을 차례로 찾아보는 퀘스트입니다.",
    theme: "한국소설",
    estimatedMinutes: 15,
    difficulty: "easy",
    steps: [
      {
        id: "step-1",
        order: 1,
        title: "첫 번째 서가로",
        description: "종합자료실 2층, 청구기호 813.7 서가에서 한강 작가의 책을 찾아보세요.",
        hint: "표지에 채식이나 흰색 이미지가 있을 수 있어요.",
        candidates: [
          { book: 채식주의자, isPrimary: true },
          { book: 소년이온다, isPrimary: false },
          { book: 흰, isPrimary: false },
        ],
      },
      {
        id: "step-2",
        order: 2,
        title: "베스트셀러를 찾아서",
        description: "같은 서가에서 100만 부 이상 팔린 한국 소설을 찾아보세요.",
        hint: "제목에 '82년생'이 들어가는 책이에요.",
        candidates: [
          { book: 김지영, isPrimary: true },
          { book: 달러구트, isPrimary: false },
        ],
      },
      {
        id: "step-3",
        order: 3,
        title: "SF 감성 소설",
        description: "한국 SF 소설로 유명한 김초엽 작가의 책을 찾아 완료하세요.",
        hint: "온실이나 빛의 속도 같은 단어가 제목에 있어요.",
        candidates: [
          { book: 온실, isPrimary: true },
          { book: 빛의속도, isPrimary: false },
        ],
      },
    ],
  },
];

export function getDemoQuestById(id: string): QuestSummary | undefined {
  return DEMO_QUESTS.find((q) => q.id === id);
}

/** ISBN 문자열을 정규화한다 (하이픈/공백 제거). */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}
