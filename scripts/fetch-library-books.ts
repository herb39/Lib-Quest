/**
 * 도서관정보나루(Data4Library) itemSrch API로 대표 도서관의 실제 등록 도서를 수집한다.
 *
 * 사용법:
 *   DATA4LIBRARY_API_KEY=발급받은키 npx tsx scripts/fetch-library-books.ts \
 *     --libCode=143136 --startDt=2026-01-01 --endDt=2026-08-19
 *
 * 결과:
 *   - data/snapshots/itemSrch-<libCode>-<startDt>_<endDt>-<실행시각>.json  (원본 API 응답, 출처 추적용)
 *   - data/collected-books.json                                          (정규화된 도서 목록, seed에서 사용)
 *
 * itemSrch는 "등록 기간" 기준 조회이며 실시간 대출 가능 여부가 아니다. registeredAt으로만 사용한다.
 *
 * 주의: 이 스크립트는 실제 API 키가 있어야 동작한다. 키가 없거나 API가 실패하면
 * 절대로 임시/가짜 데이터를 생성하지 않고 에러로 중단한다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const API_ENDPOINT = "https://data4library.kr/api/itemSrch";
const SOURCE_TAG = "DATA4LIBRARY_ITEM_SRCH";
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

type RawDoc = Record<string, unknown>;

type NormalizedBook = {
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

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const raw of argv) {
    const match = /^--([\w]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Data4Library 응답은 문서 버전에 따라 docs[].doc 또는 docs[] 형태일 수 있어 방어적으로 꺼낸다. */
function extractDocs(json: unknown): RawDoc[] {
  const root = json as { response?: { docs?: Array<{ doc?: RawDoc } | RawDoc> } };
  const docs = root?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.map((d) => (d && typeof d === "object" && "doc" in d ? (d as { doc?: RawDoc }).doc ?? {} : (d as RawDoc)));
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function normalizeDoc(doc: RawDoc): NormalizedBook | null {
  const isbnRaw = str(doc.isbn13);
  const title = str(doc.bookname);
  if (!isbnRaw || !title) return null;

  const isbn13 = normalizeIsbn(isbnRaw);
  if (isbn13.length !== 13) return null;

  return {
    isbn13,
    title,
    author: str(doc.authors),
    classNo: str(doc.class_no),
    className: str(doc.class_nm),
    callNumber: str(doc.book_code) ?? str(doc.shelf_loc_code),
    shelfLocation: str(doc.shelf_loc_name),
    registeredAt: str(doc.reg_date),
    source: SOURCE_TAG,
  };
}

async function fetchPage(params: {
  authKey: string;
  libCode: string;
  startDt: string;
  endDt: string;
  pageNo: number;
}) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set("authKey", params.authKey);
  url.searchParams.set("libCode", params.libCode);
  url.searchParams.set("startDt", params.startDt);
  url.searchParams.set("endDt", params.endDt);
  url.searchParams.set("pageNo", String(params.pageNo));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Data4Library API 호출 실패: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authKey = process.env.DATA4LIBRARY_API_KEY;

  if (!authKey) {
    throw new Error(
      "DATA4LIBRARY_API_KEY가 설정되지 않았습니다. https://data4library.kr 에서 발급받은 키를 환경변수로 지정하세요."
    );
  }

  const libCode = args.libCode ?? "143136";
  const startDt = args.startDt ?? daysAgoIso(180);
  const endDt = args.endDt ?? todayIso();

  console.log(`[fetch-library-books] libCode=${libCode} startDt=${startDt} endDt=${endDt}`);

  const allRawDocs: RawDoc[] = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const json = await fetchPage({ authKey, libCode, startDt, endDt, pageNo });
    const docs = extractDocs(json);
    console.log(`[fetch-library-books] page ${pageNo}: ${docs.length}건`);

    const snapshotDir = path.join(process.cwd(), "data", "snapshots");
    mkdirSync(snapshotDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(
      path.join(snapshotDir, `itemSrch-${libCode}-${startDt}_${endDt}-page${pageNo}-${stamp}.json`),
      JSON.stringify(json, null, 2),
      "utf-8"
    );

    allRawDocs.push(...docs);
    if (docs.length < PAGE_SIZE) break;
  }

  if (allRawDocs.length === 0) {
    throw new Error(
      "API 응답에서 도서를 찾지 못했습니다. libCode/기간을 확인하거나 authKey가 유효한지 확인하세요. " +
        "가짜 데이터로 대체하지 않고 중단합니다."
    );
  }

  const normalized = allRawDocs.map(normalizeDoc).filter((b): b is NormalizedBook => b !== null);
  const skipped = allRawDocs.length - normalized.length;
  if (skipped > 0) {
    console.warn(`[fetch-library-books] ISBN13 누락/형식 오류로 ${skipped}건 제외`);
  }

  const dedupedMap = new Map<string, NormalizedBook>();
  for (const book of normalized) {
    if (!dedupedMap.has(book.isbn13)) dedupedMap.set(book.isbn13, book);
  }
  const deduped = [...dedupedMap.values()];

  const outPath = path.join(process.cwd(), "data", "collected-books.json");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        libCode,
        startDt,
        endDt,
        source: SOURCE_TAG,
        fetchedAt: new Date().toISOString(),
        count: deduped.length,
        books: deduped,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`[fetch-library-books] 완료: 총 ${deduped.length}권 -> ${outPath}`);
  if (deduped.length < 30) {
    console.warn(
      `[fetch-library-books] 목표(30~50권)보다 적습니다. startDt/endDt 기간을 넓혀 다시 실행하세요.`
    );
  }
}

main().catch((err) => {
  console.error(`[fetch-library-books] 중단: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
