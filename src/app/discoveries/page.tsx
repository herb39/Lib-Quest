import { getLibraryList } from "@/lib/data";
import { DiscoveriesView } from "@/components/DiscoveriesView";

// 도서관별 실제 Book 수(분모)는 항상 최신 DB 값을 반영해야 하므로 매 요청마다 조회한다.
export const dynamic = "force-dynamic";

export default async function DiscoveriesPage() {
  const { libraries } = await getLibraryList();

  return (
    <DiscoveriesView
      libraries={libraries.map((lib) => ({ code: lib.code, name: lib.name, bookCount: lib.bookCount }))}
    />
  );
}
