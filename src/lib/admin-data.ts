// 운영자 검수 화면 / 데이터 출처 화면 전용 조회.
// 두 화면 모두 발표 중 검수·출처 확인이 목적이므로 데모 데이터로 대체하지 않는다.
// DATABASE_URL이 없으면 명시적으로 "DB 연결 필요" 상태를 반환한다.

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

export type AdminReviewData =
  | { available: false }
  | {
      available: true;
      library: { code: string; name: string };
      quests: AdminQuest[];
      bookCount: number;
    };

export async function getAdminReviewData(): Promise<AdminReviewData> {
  if (!process.env.DATABASE_URL) {
    return { available: false };
  }

  const { prisma } = await import("@/lib/prisma");

  const library = await prisma.library.findFirst();
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

  return {
    available: true,
    library: { code: library.code, name: library.name },
    bookCount,
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

export type DataSourceInfo =
  | { available: false }
  | {
      available: true;
      library: { code: string; name: string };
      bookCount: number;
      questCount: number;
    };

export async function getDataSourceInfo(): Promise<DataSourceInfo> {
  if (!process.env.DATABASE_URL) {
    return { available: false };
  }

  const { prisma } = await import("@/lib/prisma");
  const library = await prisma.library.findFirst();
  if (!library) {
    return { available: false };
  }

  const [bookCount, questCount] = await Promise.all([
    prisma.book.count({ where: { libraryId: library.id } }),
    prisma.quest.count({ where: { libraryId: library.id } }),
  ]);

  return {
    available: true,
    library: { code: library.code, name: library.name },
    bookCount,
    questCount,
  };
}
