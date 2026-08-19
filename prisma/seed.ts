/**
 * 실제 Data4Library 수집 데이터만 시드한다. 가짜/임시 도서 데이터는 절대 만들지 않는다.
 *
 * data/libraries/<libCode>/ 폴더 하나가 도서관 하나에 대응한다. 각 폴더는 다음을 포함해야 한다.
 *   - collected-books.json : scripts/fetch-library-books.ts 로 수집한 실제 도서 목록
 *   - quest-curation.json  : (선택) collected-books.json의 ISBN만 참조하는 퀘스트 구성
 *
 * data/libraries/ 아래 폴더가 하나도 없으면 절대 진행하지 않고 에러로 중단한다.
 * 이미 존재하는 Quest(같은 도서관에 같은 title)는 다시 만들지 않는다(재실행 안전, 중복 생성 방지).
 * 기존 데이터를 삭제하는 로직은 없다 — 실행할 때마다 새 데이터만 추가/갱신된다.
 */
import "dotenv/config";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getLibraryMeta } from "../src/lib/config";

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
  libCode?: string;
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

const LIBRARIES_DIR = path.join(process.cwd(), "data", "libraries");

/** 큐레이션이 존재하지 않는 ISBN을 참조하거나 중복 candidate를 포함하면 seed를 즉시 실패시킨다. */
function validateCuration(
  curationPath: string,
  curation: CurationFile,
  bookByIsbn: Map<string, { id: string }>
): void {
  const errors: string[] = [];

  for (const q of curation.quests) {
    const orders = q.steps.map((s) => s.order);
    const dupOrders = orders.filter((o, i) => orders.indexOf(o) !== i);
    if (dupOrders.length > 0) {
      errors.push(`퀘스트 "${q.title}": 중복된 step order (${[...new Set(dupOrders)].join(", ")})`);
    }

    for (const s of q.steps) {
      if (s.candidates.length < 3) {
        errors.push(`퀘스트 "${q.title}" ${s.order}단계: candidate가 ${s.candidates.length}개 (최소 3개 필요)`);
      }

      const isbns = s.candidates.map((c) => c.isbn13);
      const dupIsbns = isbns.filter((isbn, i) => isbns.indexOf(isbn) !== i);
      if (dupIsbns.length > 0) {
        errors.push(`퀘스트 "${q.title}" ${s.order}단계: 중복 candidate ISBN (${[...new Set(dupIsbns)].join(", ")})`);
      }

      const missingIsbns = isbns.filter((isbn) => !bookByIsbn.has(isbn));
      if (missingIsbns.length > 0) {
        errors.push(
          `퀘스트 "${q.title}" ${s.order}단계: 수집된 도서에 없는 ISBN 참조 (${missingIsbns.join(", ")})`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`${curationPath} 검증 실패:\n` + errors.map((e) => `  - ${e}`).join("\n"));
  }
}

async function seedLibrary(libCode: string) {
  const dir = path.join(LIBRARIES_DIR, libCode);
  const collectedPath = path.join(dir, "collected-books.json");
  const curationPath = path.join(dir, "quest-curation.json");

  if (!existsSync(collectedPath)) {
    throw new Error(`${collectedPath} 가 없습니다. 가짜 데이터로 시드하지 않습니다.`);
  }

  const meta = getLibraryMeta(libCode);
  if (!meta) {
    throw new Error(
      `libCode=${libCode} 가 src/lib/config.ts의 LIBRARIES에 없습니다. 먼저 등록하세요.`
    );
  }

  const collected: CollectedBooksFile = JSON.parse(readFileSync(collectedPath, "utf-8"));
  if (!collected.books || collected.books.length === 0) {
    throw new Error(`${collectedPath} 에 도서가 없습니다. 수집 스크립트를 다시 실행하세요.`);
  }
  if (collected.libCode && collected.libCode !== libCode) {
    throw new Error(
      `${collectedPath}의 libCode(${collected.libCode})가 폴더명(${libCode})과 다릅니다.`
    );
  }

  const library = await prisma.library.upsert({
    where: { code: libCode },
    update: { name: meta.name },
    create: { code: libCode, name: meta.name },
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

  console.log(`[seed] library=${library.name}(${libCode}) books=${bookByIsbn.size} (source: 실데이터, ${collectedPath})`);

  if (!existsSync(curationPath)) {
    console.warn(
      `[seed] ${curationPath} 가 없어 퀘스트는 생성하지 않았습니다. 수집된 실제 도서 목록을 검토한 뒤 큐레이션 파일을 작성하세요.`
    );
    return;
  }

  const curation: CurationFile = JSON.parse(readFileSync(curationPath, "utf-8"));
  validateCuration(curationPath, curation, bookByIsbn);

  let createdQuests = 0;
  let skippedQuests = 0;
  for (const q of curation.quests) {
    const existing = await prisma.quest.findFirst({
      where: { libraryId: library.id, title: q.title },
    });
    if (existing) {
      skippedQuests++;
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

  console.log(`[seed] library=${libCode} 완료: quests 생성=${createdQuests}, 이미 존재해 건너뜀=${skippedQuests}`);
}

async function main() {
  if (!existsSync(LIBRARIES_DIR)) {
    throw new Error(`${LIBRARIES_DIR} 가 없습니다. 가짜 데이터로 시드하지 않습니다.`);
  }

  const libCodes = readdirSync(LIBRARIES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (libCodes.length === 0) {
    throw new Error(`${LIBRARIES_DIR} 아래에 도서관 폴더가 없습니다.`);
  }

  for (const libCode of libCodes) {
    await seedLibrary(libCode);
  }

  console.log(`[seed] 전체 완료: ${libCodes.length}개 도서관 처리`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
