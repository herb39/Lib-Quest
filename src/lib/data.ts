// 화면에 필요한 퀘스트 데이터 조회.
// DATABASE_URL이 설정된 경우 항상 Neon(Prisma)에서 실데이터를 조회한다.
// 로컬에서 DB 없이 화면만 확인하고 싶을 때만 DEMO_QUESTS로 대체한다 (발표/운영에서는 사용하지 않음).
import { LIBRARY_CODE } from "@/lib/config";
import { DEMO_QUESTS, getDemoQuestById } from "@/lib/mock-data";
import type { QuestListItem, QuestSummary } from "@/lib/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

export async function getQuestList(): Promise<{ quests: QuestListItem[]; usingDemoData: boolean }> {
  if (!hasDatabase) {
    return {
      usingDemoData: true,
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
  const quests = await prisma.quest.findMany({
    where: { published: true, library: { code: LIBRARY_CODE } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { steps: true } } },
  });

  return {
    usingDemoData: false,
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
        },
      })),
    })),
  };
}
