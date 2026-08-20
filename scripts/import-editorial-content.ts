/**
 * data/libraries/<libCode>/book-editorial.json, quest-missions.json(JSON baseline)을
 * BookEditorial/MissionContent 테이블의 초기 데이터로 넣는 일회성 import 스크립트.
 *
 * 재실행 안전(idempotent): 이미 해당 book/questStep에 row가 있으면 절대 덮어쓰지 않고 건너뛴다
 * (운영자가 이미 수정한 내용을 이 스크립트 재실행으로 잃지 않기 위함). JSON baseline으로
 * "되돌리는" 것은 별도의 /api/admin/demo-reset가 담당한다.
 *
 * baseline에 실제 콘텐츠가 있는 책/Step은 reviewStatus=APPROVED, isPublished=true로 넣는다 —
 * 기존에 이미 공개되어 있던 콘텐츠이므로, import 직후 갑자기 사용자 화면에서 사라지면 안 된다.
 */
import "dotenv/config";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadEditorialBaseline, loadMissionBaseline } from "../src/lib/content-baseline";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LIBRARIES_DIR = path.join(__dirname, "..", "data", "libraries");

async function importEditorial(libCode: string, libraryId: string) {
  const baseline = loadEditorialBaseline(libCode);
  if (!baseline) return { created: 0, skipped: 0, total: 0 };

  let created = 0;
  let skipped = 0;
  for (const [isbn13, content] of Object.entries(baseline)) {
    const book = await prisma.book.findUnique({ where: { libraryId_isbn13: { libraryId, isbn13 } } });
    if (!book) {
      console.warn(`[import-editorial] ${libCode} ISBN=${isbn13} 에 해당하는 Book이 DB에 없어 건너뜀`);
      continue;
    }
    const existing = await prisma.bookEditorial.findUnique({ where: { bookId: book.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.bookEditorial.create({
      data: {
        bookId: book.id,
        hook: content.hook,
        teaser: content.teaser,
        question: content.question,
        reviewStatus: "APPROVED",
        isPublished: true,
      },
    });
    created++;
  }
  return { created, skipped, total: Object.keys(baseline).length };
}

async function importMissions(libCode: string, libraryId: string) {
  const baseline = loadMissionBaseline(libCode);
  if (!baseline) return { created: 0, skipped: 0, total: 0 };

  let created = 0;
  let skipped = 0;
  let total = 0;
  for (const [questTitle, steps] of Object.entries(baseline)) {
    const quest = await prisma.quest.findFirst({ where: { libraryId, title: questTitle } });
    if (!quest) {
      console.warn(`[import-mission] ${libCode} Quest="${questTitle}" 이 DB에 없어 건너뜀`);
      continue;
    }
    for (const [orderStr, content] of Object.entries(steps)) {
      total++;
      const order = Number(orderStr);
      const step = await prisma.questStep.findFirst({ where: { questId: quest.id, order } });
      if (!step) {
        console.warn(`[import-mission] ${libCode} Quest="${questTitle}" Step=${order} 이 DB에 없어 건너뜀`);
        continue;
      }
      const existing = await prisma.missionContent.findUnique({ where: { questStepId: step.id } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.missionContent.create({
        data: {
          questStepId: step.id,
          missionTitle: content.missionTitle,
          missionNarrative: content.missionNarrative,
          reviewStatus: "APPROVED",
          isPublished: true,
        },
      });
      created++;
    }
  }
  return { created, skipped, total };
}

async function main() {
  const libCodes = readdirSync(LIBRARIES_DIR).filter((d) =>
    existsSync(path.join(LIBRARIES_DIR, d, "book-editorial.json")) ||
    existsSync(path.join(LIBRARIES_DIR, d, "quest-missions.json"))
  );

  for (const libCode of libCodes) {
    const library = await prisma.library.findUnique({ where: { code: libCode } });
    if (!library) {
      console.warn(`[import] library code=${libCode} 가 DB에 없어 건너뜀`);
      continue;
    }
    const editorialResult = await importEditorial(libCode, library.id);
    const missionResult = await importMissions(libCode, library.id);
    console.log(
      `[import] ${libCode}: editorial 생성=${editorialResult.created} 건너뜀=${editorialResult.skipped} (baseline ${editorialResult.total}건), ` +
        `mission 생성=${missionResult.created} 건너뜀=${missionResult.skipped} (baseline ${missionResult.total}건)`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
