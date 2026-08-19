/**
 * Data4Library 도서관 검색 API(libSrch)로 실제 libCode를 조회한다.
 *
 * libCode를 추측/하드코딩하지 않기 위한 스크립트다. 반드시 이 스크립트(또는 동등한 실제 API 호출)로
 * 확인된 값만 src/lib/config.ts의 LIBRARY_CODE에 반영한다.
 *
 * 실측 결과: libSrch의 `keyword` 파라미터는 서버 측에서 필터링하지 않고 전체 도서관 목록을
 * 그대로 반환한다(2026-08 기준 numFound=1602). 그래서 이 스크립트는 전체 목록을 pageSize로
 * 나눠 받아온 뒤 도서관명에 검색어가 포함되는 항목만 클라이언트에서 걸러낸다.
 *
 * 사용법:
 *   DATA4LIBRARY_API_KEY=발급받은키 npx tsx scripts/lookup-library.ts --keyword=원신흥도서관
 *
 * 결과가 여러 건이면 도서관명/주소를 비교해 대상 도서관을 직접 확인해야 한다.
 * 이 스크립트는 후보 목록만 출력하며, libCode를 자동으로 확정하지 않는다.
 */
import "dotenv/config";

const API_ENDPOINT = "https://data4library.kr/api/libSrch";
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

type RawLib = Record<string, unknown>;

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const raw of argv) {
    const match = /^--([\w]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

/** 응답 스키마가 libs[].lib 또는 libs[] 형태일 수 있어 방어적으로 꺼낸다. */
function extractLibs(json: unknown): RawLib[] {
  const root = json as { response?: { libs?: Array<{ lib?: RawLib } | RawLib> } };
  const libs = root?.response?.libs;
  if (!Array.isArray(libs)) return [];
  return libs.map((l) => (l && typeof l === "object" && "lib" in l ? (l as { lib?: RawLib }).lib ?? {} : (l as RawLib)));
}

async function fetchAllLibs(authKey: string): Promise<RawLib[]> {
  const all: RawLib[] = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("authKey", authKey);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Data4Library API 호출 실패: HTTP ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const libs = extractLibs(json);
    all.push(...libs);
    if (libs.length < PAGE_SIZE) break;
  }
  return all;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authKey = process.env.DATA4LIBRARY_API_KEY;

  if (!authKey) {
    throw new Error(
      "DATA4LIBRARY_API_KEY가 설정되지 않았습니다. https://data4library.kr 에서 발급받은 키를 환경변수로 지정하세요."
    );
  }

  const keyword = args.keyword;
  if (!keyword) {
    throw new Error("--keyword=검색할도서관명 인자가 필요합니다. 예: --keyword=원신흥도서관");
  }

  console.log(`[lookup-library] 전체 도서관 목록 조회 중 (검색어="${keyword}" 클라이언트 필터링)...`);
  const allLibs = await fetchAllLibs(authKey);
  console.log(`[lookup-library] 전체 ${allLibs.length}건 중 도서관명에 "${keyword}"가 포함된 항목 필터링`);

  const matched = allLibs.filter((lib) => String(lib.libName ?? "").includes(keyword));

  if (matched.length === 0) {
    throw new Error(`도서관명에 "${keyword}"를 포함하는 결과가 없습니다.`);
  }

  console.log(`[lookup-library] ${matched.length}건 발견. 아래 목록에서 대상 도서관을 직접 확인하세요.\n`);
  for (const lib of matched) {
    console.log(
      [
        `libCode: ${lib.libCode ?? "(없음)"}`,
        `libName: ${lib.libName ?? "(없음)"}`,
        `address: ${lib.address ?? "(없음)"}`,
        `homepage: ${lib.homepage ?? "(없음)"}`,
        `BookCount: ${lib.BookCount ?? "(없음)"}`,
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error(`[lookup-library] 중단: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
