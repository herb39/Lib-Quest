/**
 * Data4Library 도서관 검색 API(libSrch)로 실제 libCode를 조회한다.
 *
 * libCode를 추측/하드코딩하지 않기 위한 스크립트다. 반드시 이 스크립트(또는 동등한 실제 API 호출)로
 * 확인된 값만 src/lib/config.ts의 LIBRARY_CODE에 반영한다.
 *
 * 사용법:
 *   DATA4LIBRARY_API_KEY=발급받은키 npx tsx scripts/lookup-library.ts --keyword=원신흥도서관
 *
 * 결과가 여러 건이면 도서관명/주소/지역을 비교해 대상 도서관을 직접 확인해야 한다.
 * 이 스크립트는 후보 목록만 출력하며, libCode를 자동으로 확정하지 않는다.
 */
const API_ENDPOINT = "https://data4library.kr/api/libSrch";

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

  const url = new URL(API_ENDPOINT);
  url.searchParams.set("authKey", authKey);
  url.searchParams.set("keyword", keyword);
  if (args.region) url.searchParams.set("region", args.region);
  url.searchParams.set("format", "json");

  console.log(`[lookup-library] 검색어="${keyword}"${args.region ? ` region=${args.region}` : ""}`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Data4Library API 호출 실패: HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const libs = extractLibs(json);

  if (libs.length === 0) {
    throw new Error(
      `"${keyword}"에 대한 검색 결과가 없습니다. 응답 원본: ${JSON.stringify(json).slice(0, 500)}`
    );
  }

  console.log(`[lookup-library] ${libs.length}건 발견. 아래 목록에서 대상 도서관을 직접 확인하세요.\n`);
  for (const lib of libs) {
    console.log(
      [
        `libCode: ${lib.libCode ?? "(없음)"}`,
        `libName: ${lib.libName ?? "(없음)"}`,
        `address: ${lib.address ?? "(없음)"}`,
        `region/dtl_region: ${lib.region ?? "?"}/${lib.dtl_region ?? "?"}`,
        `homepage: ${lib.homepage ?? "(없음)"}`,
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error(`[lookup-library] 중단: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
