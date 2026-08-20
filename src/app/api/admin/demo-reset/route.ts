import { NextResponse } from "next/server";
import { LIBRARIES } from "@/lib/config";
import { loadEditorialBaseline, loadMissionBaseline } from "@/lib/content-baseline";

// 운영자 "데모 데이터 초기화" — 이 도서관의 BookEditorial/MissionContent(운영자가 수정했을 수 있는
// 운영 콘텐츠)만 JSON baseline 상태로 되돌린다. Library/Book/Quest/QuestStep/QuestCandidate(장서·
// Quest 구성 자체)는 절대 건드리지 않는다. GET을 export하지 않아 실수로 GET 요청이 오면 자동으로
// 405가 되고, libraryCode는 src/lib/config.ts의 알려진 도서관 목록으로만 whitelist한다(클라이언트가
// 임의 문자열/JSON 경로를 넘기게 하지 않음).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const libraryCode = body.libraryCode;
  if (typeof libraryCode !== "string" || !LIBRARIES.some((l) => l.code === libraryCode)) {
    return NextResponse.json({ success: false, message: "알 수 없는 도서관입니다." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  const library = await prisma.library.findUnique({ where: { code: libraryCode } });
  if (!library) {
    return NextResponse.json({ success: false, message: "존재하지 않는 도서관입니다." }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const books = await tx.book.findMany({
        where: { libraryId: library.id },
        select: { id: true, isbn13: true },
      });
      const quests = await tx.quest.findMany({
        where: { libraryId: library.id },
        select: { id: true, title: true, steps: { select: { id: true, order: true } } },
      });
      const bookIds = books.map((b) => b.id);
      const stepIds = quests.flatMap((q) => q.steps.map((s) => s.id));

      // 기존 운영 콘텐츠를 전부 지우고 baseline만으로 다시 만든다(delete + recreate를 한
      // transaction으로 묶어 일부만 반영되는 상태를 방지).
      await tx.bookEditorial.deleteMany({ where: { bookId: { in: bookIds } } });
      await tx.missionContent.deleteMany({ where: { questStepId: { in: stepIds } } });

      const editorialBaseline = loadEditorialBaseline(libraryCode) ?? {};
      let editorialRestored = 0;
      for (const book of books) {
        const entry = editorialBaseline[book.isbn13];
        if (!entry) continue;
        await tx.bookEditorial.create({
          data: {
            bookId: book.id,
            hook: entry.hook,
            teaser: entry.teaser,
            question: entry.question,
            reviewStatus: "APPROVED",
            isPublished: true,
          },
        });
        editorialRestored++;
      }

      const missionBaseline = loadMissionBaseline(libraryCode) ?? {};
      let missionRestored = 0;
      for (const quest of quests) {
        const stepsBaseline = missionBaseline[quest.title];
        if (!stepsBaseline) continue;
        for (const step of quest.steps) {
          const entry = stepsBaseline[String(step.order)];
          if (!entry) continue;
          await tx.missionContent.create({
            data: {
              questStepId: step.id,
              missionTitle: entry.missionTitle,
              missionNarrative: entry.missionNarrative,
              reviewStatus: "APPROVED",
              isPublished: true,
            },
          });
          missionRestored++;
        }
      }

      return { editorialRestored, missionRestored };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[admin/demo-reset] failed", e);
    return NextResponse.json({ success: false, message: "초기화하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
