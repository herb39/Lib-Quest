/**
 * 실제 Data4Library 수집 데이터만 시드한다. 가짜/임시 도서 데이터는 절대 만들지 않는다.
 *
 * 사전 조건:
 *   1) npx tsx scripts/fetch-library-books.ts 로 data/collected-books.json 생성
 *   2) (선택) data/quest-curation.json 에 실제 수집된 ISBN13을 참조하는 퀘스트 구성 작성
 *
 * data/collected-books.json이 없으면 절대 진행하지 않고 에러로 중단한다.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { LIBRARY_CODE, LIBRARY_NAME } from "../src/lib/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type CollectedBook = {
  isbn13: string;
  title: string;
  author: string | null;
  classNo: string | null;
  className: string | null;
  callNumber: string | null;
  shelfLocation: string | null;
  registeredAt: string | null;
  source: string;
};

type CollectedBooksFile = {
  count: number;
  books: CollectedBook[];
};

type CurationCandidate = { isbn13: string; isPrimary?: boolean };
type CurationStep = {
  order: number;
  title: string;
  description: string;
  hint?: string;
  candidates: CurationCandidate[];
};
type CurationQuest = {
  title: string;
  description: string;
  theme?: string;
  estimatedMinutes?: number;
  difficulty?: string;
  published?: boolean;
  steps: CurationStep[];
};
type CurationFile = { quests: CurationQuest[] };

const COLLECTED_BOOKS_PATH = path.join(process.cwd(), "data", "collected-books.json");
const QUEST_CURATION_PATH = path.join(process.cwd(), "data", "quest-curation.json");

async function main() {
  if (!existsSync(COLLECTED_BOOKS_PATH)) {
    throw new Error(
      `${COLLECTED_BOOKS_PATH} 가 없습니다. 먼저 "npx tsx scripts/fetch-library-books.ts"로 실제 도서 데이터를 수집하세요. ` +
        "가짜 데이터로 시드하지 않습니다."
    );
  }

  const collected: CollectedBooksFile = JSON.parse(readFileSync(COLLECTED_BOOKS_PATH, "utf-8"));
  if (!collected.books || collected.books.length === 0) {
    throw new Error(`${COLLECTED_BOOKS_PATH} 에 도서가 없습니다. 수집 스크립트를 다시 실행하세요.`);
  }

  const library = await prisma.library.upsert({
    where: { code: LIBRARY_CODE },
    update: { name: LIBRARY_NAME },
    create: { code: LIBRARY_CODE, name: LIBRARY_NAME },
  });

  const bookByIsbn = new Map<string, { id: string; isbn13: string; title: string }>();
  for (const b of collected.books) {
    const book = await prisma.book.upsert({
      where: { libraryId_isbn13: { libraryId: library.id, isbn13: b.isbn13 } },
      update: {
        title: b.title,
        author: b.author,
        classNo: b.classNo,
        className: b.className,
        callNumber: b.callNumber,
        shelfLocation: b.shelfLocation,
        registeredAt: b.registeredAt ? new Date(b.registeredAt) : null,
        source: b.source,
      },
      create: {
        libraryId: library.id,
        isbn13: b.isbn13,
        title: b.title,
        author: b.author,
        classNo: b.classNo,
        className: b.className,
        callNumber: b.callNumber,
        shelfLocation: b.shelfLocation,
        registeredAt: b.registeredAt ? new Date(b.registeredAt) : null,
        source: b.source,
      },
    });
    bookByIsbn.set(book.isbn13, book);
  }

  console.log(`[seed] library=${library.name} books=${bookByIsbn.size} (source: 실데이터, ${COLLECTED_BOOKS_PATH})`);

  if (!existsSync(QUEST_CURATION_PATH)) {
    console.warn(
      `[seed] ${QUEST_CURATION_PATH} 가 없어 퀘스트는 생성하지 않았습니다. ` +
        "수집된 실제 도서 목록을 검토한 뒤 큐레이션 파일을 작성하세요."
    );
    return;
  }

  const curation: CurationFile = JSON.parse(readFileSync(QUEST_CURATION_PATH, "utf-8"));
  let createdQuests = 0;

  for (const q of curation.quests) {
    const missingIsbns = q.steps
      .flatMap((s) => s.candidates.map((c) => c.isbn13))
      .filter((isbn) => !bookByIsbn.has(isbn));

    if (missingIsbns.length > 0) {
      console.warn(
        `[seed] 퀘스트 "${q.title}" 건너뜀: 수집된 도서에 없는 ISBN 참조 (${missingIsbns.join(", ")})`
      );
      continue;
    }

    await prisma.quest.create({
      data: {
        libraryId: library.id,
        title: q.title,
        description: q.description,
        theme: q.theme,
        estimatedMinutes: q.estimatedMinutes,
        difficulty: q.difficulty,
        published: q.published ?? false,
        steps: {
          create: q.steps.map((s) => ({
            order: s.order,
            title: s.title,
            description: s.description,
            hint: s.hint,
            candidates: {
              create: s.candidates.map((c) => ({
                bookId: bookByIsbn.get(c.isbn13)!.id,
                isPrimary: c.isPrimary ?? false,
              })),
            },
          })),
        },
      },
    });
    createdQuests++;
  }

  console.log(`[seed] 완료: quests=${createdQuests}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
