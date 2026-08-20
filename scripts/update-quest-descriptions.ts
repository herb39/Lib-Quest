/**
 * data/libraries/<libCode>/quest-curation.json 의 Quest.description만 기존 DB row에 반영하는
 * 일회성 스크립트.
 *
 * prisma/seed.ts는 이미 존재하는 Quest(같은 도서관 + 같은 title)를 재실행 안전을 위해 건드리지
 * 않으므로, curation JSON만 고쳐서는 이미 시드된 production 값이 절대 바뀌지 않는다. 이 스크립트는
 * 그 간극을 메우기 위해 Quest.description 필드 하나만 (libraryId, title) 기준으로 update한다.
 * Step/Candidate/Book 등 다른 관계는 전혀 건드리지 않는다 — 삭제/재생성 없음.
 */
import "dotenv/config";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LIBRARIES_DIR = path.join(__dirname, "..", "data", "libraries");

async function main() {
  const libCodes = readdirSync(LIBRARIES_DIR).filter((d) =>
    existsSync(path.join(LIBRARIES_DIR, d, "quest-curation.json"))
  );

  let totalUpdated = 0;
  for (const libCode of libCodes) {
    const library = await prisma.library.findUnique({ where: { code: libCode } });
    if (!library) {
      console.warn(`[update-descriptions] library code=${libCode} 가 DB에 없어 건너뜀`);
      continue;
    }

    const curationPath = path.join(LIBRARIES_DIR, libCode, "quest-curation.json");
    const curation = JSON.parse(readFileSync(curationPath, "utf-8")) as {
      quests: { title: string; description: string }[];
    };

    for (const q of curation.quests) {
      const result = await prisma.quest.updateMany({
        where: { libraryId: library.id, title: q.title },
        data: { description: q.description },
      });
      if (result.count > 0) {
        console.log(`[update-descriptions] ${libCode} / "${q.title}" description 갱신 (${result.count}건)`);
        totalUpdated += result.count;
      } else {
        console.warn(`[update-descriptions] ${libCode} / "${q.title}" 에 해당하는 Quest row 없음`);
      }
    }
  }

  console.log(`[update-descriptions] 완료: 총 ${totalUpdated}건 갱신`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
