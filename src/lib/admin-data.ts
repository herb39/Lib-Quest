// 운영자 콘솔(/admin/review) / 데이터 출처 화면 전용 조회.
// 두 화면 모두 발표 중 검수·출처 확인이 목적이므로 데모 데이터로 대체하지 않는다.
// DATABASE_URL이 없으면 명시적으로 "DB 연결 필요" 상태를 반환한다.
//
// P1: BookEditorial/MissionContent가 DB source of truth가 된 이후에도, 운영자 화면은 (이용자
// 화면과 달리) 미공개/초안 콘텐츠까지 전부 그대로 보여준다 — 검수가 필요한 이유다.
import { DEFAULT_LIBRARY_CODE } from "@/lib/config";
import { getCoverUrl } from "@/lib/covers";

export type ReviewStatusValue = "DRAFT" | "REVIEW_NEEDED" | "APPROVED";

export type AdminEditorial = {
  hook: string | null;
  teaser: string | null;
  question: string | null;
  reviewStatus: ReviewStatusValue;
  isPublished: boolean;
  updatedAt: string | null;
  /** DB에 아직 row가 없으면 true — editor가 "콘텐츠 없음"과 "빈 문자열로 저장됨"을 구분해 보여준다. */
  exists: boolean;
};

export type AdminBook = {
  id: string;
  isbn13: string;
  title: string;
  author: string | null;
  classNo: string | null;
  className: string | null;
  callNumber: string | null;
  shelfLocation: string | null;
  source: string;
  coverUrl: string | null;
  editorial: AdminEditorial;
};

export type AdminCandidate = {
  isPrimary: boolean;
  book: AdminBook;
};

export type AdminMission = {
  missionTitle: string | null;
  missionNarrative: string | null;
  reviewStatus: ReviewStatusValue;
  isPublished: boolean;
  updatedAt: string | null;
  exists: boolean;
};

export type AdminStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  mission: AdminMission;
  candidates: AdminCandidate[];
};

export type AdminQuest = {
  id: string;
  title: string;
  description: string;
  theme: string | null;
  difficulty: string | null;
  published: boolean;
  steps: AdminStep[];
};

export type AdminLibraryOption = { code: string; name: string };

export type AdminSummary = {
  questCount: number;
  stepCount: number;
  candidateCount: number;
  bookCount: number;
  missionApprovedCount: number;
  editorialApprovedCount: number;
  publishedContentCount: number; // mission + editorial 중 isPublished=true 합계
};

export type AdminReviewData =
  | { available: false }
  | {
      available: true;
      library: { code: string; name: string };
      libraryOptions: AdminLibraryOption[];
      quests: AdminQuest[];
      summary: AdminSummary;
    };

const EMPTY_EDITORIAL: Omit<AdminEditorial, "exists"> = {
  hook: null,
  teaser: null,
  question: null,
  reviewStatus: "DRAFT",
  isPublished: false,
  updatedAt: null,
};

const EMPTY_MISSION: Omit<AdminMission, "exists"> = {
  missionTitle: null,
  missionNarrative: null,
  reviewStatus: "DRAFT",
  isPublished: false,
  updatedAt: null,
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
          include: {
            missionContent: true,
            candidates: { include: { book: { include: { editorial: true } } } },
          },
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

  let missionApprovedCount = 0;
  let missionPublishedCount = 0;
  let editorialApprovedCount = 0;
  let editorialPublishedCount = 0;
  // 같은 책이 여러 Step의 후보로 중복 등장할 수 있어(같은 도서관 내에서는 드물지만 데이터
  // 구조상 가능), Editorial 집계는 bookId 기준으로 한 번만 센다.
  const seenBookIds = new Set<string>();

  const adminQuests: AdminQuest[] = quests.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    theme: q.theme,
    difficulty: q.difficulty,
    published: q.published,
    steps: q.steps.map((s) => {
      const mc = s.missionContent;
      if (mc?.reviewStatus === "APPROVED") missionApprovedCount++;
      if (mc?.isPublished) missionPublishedCount++;

      return {
        id: s.id,
        order: s.order,
        title: s.title,
        description: s.description,
        mission: mc
          ? {
              missionTitle: mc.missionTitle,
              missionNarrative: mc.missionNarrative,
              reviewStatus: mc.reviewStatus,
              isPublished: mc.isPublished,
              updatedAt: mc.updatedAt.toISOString(),
              exists: true,
            }
          : { ...EMPTY_MISSION, exists: false },
        candidates: s.candidates.map((c) => {
          const ed = c.book.editorial;
          if (!seenBookIds.has(c.book.id)) {
            seenBookIds.add(c.book.id);
            if (ed?.reviewStatus === "APPROVED") editorialApprovedCount++;
            if (ed?.isPublished) editorialPublishedCount++;
          }
          return {
            isPrimary: c.isPrimary,
            book: {
              id: c.book.id,
              isbn13: c.book.isbn13,
              title: c.book.title,
              author: c.book.author,
              classNo: c.book.classNo,
              className: c.book.className,
              callNumber: c.book.callNumber,
              shelfLocation: c.book.shelfLocation,
              source: c.book.source,
              coverUrl: getCoverUrl(c.book.isbn13),
              editorial: ed
                ? {
                    hook: ed.hook,
                    teaser: ed.teaser,
                    question: ed.question,
                    reviewStatus: ed.reviewStatus,
                    isPublished: ed.isPublished,
                    updatedAt: ed.updatedAt.toISOString(),
                    exists: true,
                  }
                : { ...EMPTY_EDITORIAL, exists: false },
            },
          };
        }),
      };
    }),
  }));

  return {
    available: true,
    library: { code: library.code, name: library.name },
    libraryOptions,
    quests: adminQuests,
    summary: {
      questCount: quests.length,
      stepCount,
      candidateCount,
      bookCount,
      missionApprovedCount,
      editorialApprovedCount,
      publishedContentCount: missionPublishedCount + editorialPublishedCount,
    },
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
