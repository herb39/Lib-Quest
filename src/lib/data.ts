// 화면에 필요한 퀘스트 데이터 조회.
// DATABASE_URL이 설정된 경우 항상 Neon(Prisma)에서 실데이터를 조회한다.
// 로컬에서 DB 없이 화면만 확인하고 싶을 때만 DEMO_QUESTS로 대체한다 (발표/운영에서는 사용하지 않음).
import { DEFAULT_LIBRARY_CODE, LIBRARIES } from "@/lib/config";
import { DEMO_QUESTS, getDemoQuestById } from "@/lib/mock-data";
import type { QuestListItem, QuestSummary } from "@/lib/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

export type LibraryListItem = {
  code: string;
  name: string;
  region: string;
  isFeatured: boolean;
  questCount: number;
  bookCount: number;
};

/** 메인 화면의 도서관 선택 카드에 쓰는 목록. DB가 없으면 데모 도서관 1곳만 보여준다. */
export async function getLibraryList(): Promise<{ libraries: LibraryListItem[]; usingDemoData: boolean }> {
  if (!hasDatabase) {
    return {
      usingDemoData: true,
      libraries: [
        {
          code: DEFAULT_LIBRARY_CODE,
          name: "데모 도서관",
          region: "DB 미설정 (데모 데이터)",
          isFeatured: true,
          questCount: DEMO_QUESTS.length,
          bookCount: 0,
        },
      ],
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const dbLibraries = await prisma.library.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { quests: { where: { published: true } }, books: true },
      },
    },
  });

  const libraries = dbLibraries.map((lib) => {
    const meta = LIBRARIES.find((m) => m.code === lib.code);
    return {
      code: lib.code,
      name: lib.name,
      region: meta?.region ?? "",
      isFeatured: meta?.isFeatured ?? false,
      questCount: lib._count.quests,
      bookCount: lib._count.books,
    };
  });

  return { usingDemoData: false, libraries };
}

export async function getQuestList(
  libraryCode: string = DEFAULT_LIBRARY_CODE
): Promise<{ quests: QuestListItem[]; usingDemoData: boolean; libraryName: string | null }> {
  if (!hasDatabase) {
    return {
      usingDemoData: true,
      libraryName: "데모 도서관",
      quests: DEMO_QUESTS.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        theme: q.theme,
        estimatedMinutes: q.estimatedMinutes,
        difficulty: q.difficulty,
        stepCount: q.steps.length,
      })),
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const library = await prisma.library.findUnique({ where: { code: libraryCode } });
  if (!library) {
    return { usingDemoData: false, libraryName: null, quests: [] };
  }

  const quests = await prisma.quest.findMany({
    where: { published: true, libraryId: library.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { steps: true } } },
  });

  return {
    usingDemoData: false,
    libraryName: library.name,
    quests: quests.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      theme: q.theme,
      estimatedMinutes: q.estimatedMinutes,
      difficulty: q.difficulty,
      stepCount: q._count.steps,
    })),
  };
}

export async function getQuestDetail(id: string): Promise<QuestSummary | undefined> {
  if (!hasDatabase) {
    return getDemoQuestById(id);
  }

  const { prisma } = await import("@/lib/prisma");
  const quest = await prisma.quest.findUnique({
    where: { id },
    include: {
      library: true,
      steps: {
        orderBy: { order: "asc" },
        include: { candidates: { include: { book: true } } },
      },
    },
  });

  if (!quest || !quest.published) return undefined;

  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    theme: quest.theme,
    estimatedMinutes: quest.estimatedMinutes,
    difficulty: quest.difficulty,
    libraryName: quest.library.name,
    libraryCode: quest.library.code,
    steps: quest.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      description: step.description,
      hint: step.hint,
      candidates: step.candidates.map((c) => ({
        isPrimary: c.isPrimary,
        book: {
          id: c.book.id,
          isbn13: c.book.isbn13,
          title: c.book.title,
          author: c.book.author,
          callNumber: c.book.callNumber,
          shelfLocation: c.book.shelfLocation,
          className: c.book.className,
        },
      })),
    })),
  };
}
