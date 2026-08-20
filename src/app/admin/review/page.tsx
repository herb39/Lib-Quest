import { DEFAULT_LIBRARY_CODE } from "@/lib/config";
import { getAdminReviewData } from "@/lib/admin-data";
import { AdminConsole } from "@/components/AdminConsole";

// 운영자 콘솔. 사서/운영자/발표자가 PC로 보는 화면이므로 desktop-first(넓은 content width)로
// 구성한다. 로그인/권한/RBAC/audit log는 이 공모전 데모 범위에 없다(docs/OPERATOR_GUIDE.md 참고) —
// 대신 write API(/api/admin/*)가 수정 가능한 필드를 운영 콘텐츠(BookEditorial/MissionContent)로만
// 제한하고, 장서/Quest 구성 자체는 이 화면에서도 읽기 전용이다.
export const dynamic = "force-dynamic";

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string }>;
}) {
  const { library } = await searchParams;
  const libraryCode = library ?? DEFAULT_LIBRARY_CODE;
  const data = await getAdminReviewData(libraryCode);

  if (!data.available) {
    return (
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-6 py-8">
        <h1 className="text-xl font-bold">Lib Quest 운영 콘솔</h1>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          DB(DATABASE_URL)가 설정되지 않아 운영 콘텐츠를 표시할 수 없습니다.
        </p>
      </main>
    );
  }

  return (
    <AdminConsole
      library={data.library}
      libraryOptions={data.libraryOptions}
      quests={data.quests}
      summary={data.summary}
    />
  );
}
