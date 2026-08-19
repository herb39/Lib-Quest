// 운영자 검수 화면 / 데이터 출처 화면 전용 조회.
// 두 화면 모두 발표 중 검수·출처 확인이 목적이므로 데모 데이터로 대체하지 않는다.
// DATABASE_URL이 없으면 명시적으로 "DB 연결 필요" 상태를 반환한다.
import { DEFAULT_LIBRARY_CODE } from "@/lib/config";

export type AdminBook = {
  isbn13: string;
  title: string;
  author: string | null;
  classNo: string | null;
  className: string | null;
  callNumber: string | null;
  shelfLocation: string | null;
  source: string;
};

export type AdminCandidate = {
  isPrimary: boolean;
  book: AdminBook;
};

export type AdminStep = {
  order: number;
  title: string;
  candidates: AdminCandidate[];
};

export type AdminQuest = {
  title: string;
  theme: string | null;
  difficulty: string | null;
  published: boolean;
  steps: AdminStep[];
};

export type AdminLibraryOption = { code: string; name: string };

export type AdminReviewData =
  | { available: false }
  | {
      available: true;
      library: { code: string; name: string };
      libraryOptions: AdminLibraryOption[];
      quests: AdminQuest[];
      bookCount: number;
      stepCount: number;
      candidateCount: number;
    };

export async function getAdminReviewData(
  libraryCode: string = DEFAULT_LIBRARY_CODE
): Promise<AdminReviewData> {
  if (!process.env.DATABASE_URL) {
    return { available: false };
  }

  const { prisma } = await import("@/lib/prisma");

  const [libraryOptions, library] = await Promise.all([
    prisma.library.findMany({ orderBy: { createdAt: "asc" }, select: { code: true, name: true } }),
    prisma.library.findUnique({ where: { code: libraryCode } }),
  ]);

  if (!library) {
    return { available: false };
  }

  const [quests, bookCount] = await Promise.all([
    prisma.quest.findMany({
      where: { libraryId: library.id },
      orderBy: { createdAt: "asc" },
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: { candidates: { include: { book: true } } },
        },
      },
    }),
    prisma.book.count({ where: { libraryId: library.id } }),
  ]);

  const stepCount = quests.reduce((sum, q) => sum + q.steps.length, 0);
  const candidateCount = quests.reduce(
    (sum, q) => sum + q.steps.reduce((s, step) => s + step.candidates.length, 0),
    0
  );

  return {
    available: true,
    library: { code: library.code, name: library.name },
    libraryOptions,
    bookCount,
    stepCount,
    candidateCount,
    quests: quests.map((q) => ({
      title: q.title,
      theme: q.theme,
      difficulty: q.difficulty,
      published: q.published,
      steps: q.steps.map((s) => ({
        order: s.order,
        title: s.title,
        candidates: s.candidates.map((c) => ({
          isPrimary: c.isPrimary,
          book: {
            isbn13: c.book.isbn13,
            title: c.book.title,
            author: c.book.author,
            classNo: c.book.classNo,
            className: c.book.className,
            callNumber: c.book.callNumber,
            shelfLocation: c.book.shelfLocation,
            source: c.book.source,
          },
        })),
      })),
    })),
  };
}

export type DataSourceLibraryStat = {
  code: string;
  name: string;
  bookCount: number;
  questCount: number;
};

export type DataSourceInfo =
  | { available: false }
  | {
      available: true;
      libraries: DataSourceLibraryStat[];
      totalBookCount: number;
      totalQuestCount: number;
    };

export async function getDataSourceInfo(): Promise<DataSourceInfo> {
  if (!process.env.DATABASE_URL) {
    return { available: false };
  }

  const { prisma } = await import("@/lib/prisma");
  const dbLibraries = await prisma.library.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { books: true, quests: true } } },
  });

  if (dbLibraries.length === 0) {
    return { available: false };
  }

  const libraries = dbLibraries.map((lib) => ({
    code: lib.code,
    name: lib.name,
    bookCount: lib._count.books,
    questCount: lib._count.quests,
  }));

  return {
    available: true,
    libraries,
    totalBookCount: libraries.reduce((sum, l) => sum + l.bookCount, 0),
    totalQuestCount: libraries.reduce((sum, l) => sum + l.questCount, 0),
  };
}
