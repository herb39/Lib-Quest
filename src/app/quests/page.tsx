import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_LIBRARY_CODE } from "@/lib/config";
import { getQuestList } from "@/lib/data";

// DB 상태를 항상 최신으로 보여줘야 하므로 빌드 시점 정적 생성 대신 요청마다 조회한다.
export const dynamic = "force-dynamic";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string }>;
}) {
  const { library } = await searchParams;
  const libraryCode = library ?? DEFAULT_LIBRARY_CODE;
  const { quests, usingDemoData, libraryName } = await getQuestList(libraryCode);

  // library 쿼리로 들어온 코드가 DB에 없는 도서관이면(잘못된 코드 등) 명확히 404 처리한다.
  if (!usingDemoData && libraryName === null) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Link href="/" className="text-xs text-slate-400">
        ← 도서관 선택
      </Link>
      <h1 className="mt-2 text-xl font-bold">{libraryName ?? "퀘스트"} 퀘스트</h1>
      <p className="mt-1 text-sm text-slate-500">
        원하는 퀘스트를 골라 서가 탐험을 시작하세요.
      </p>

      {usingDemoData && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          DB(DATABASE_URL)가 설정되지 않아 데모 데이터로 표시 중입니다.
        </p>
      )}

      {quests.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">아직 공개된 퀘스트가 없습니다.</p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {quests.map((quest) => {
          const playable = quest.stepCount > 0;
          return (
            <li key={quest.id}>
              <Link
                href={playable ? `/quests/${quest.id}` : "#"}
                aria-disabled={!playable}
                className={`block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                  playable ? "active:bg-slate-50" : "pointer-events-none opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {quest.theme}
                  </span>
                  <span className="text-xs text-slate-400">
                    {quest.difficulty ? DIFFICULTY_LABEL[quest.difficulty] : ""}
                    {quest.estimatedMinutes ? ` · 약 ${quest.estimatedMinutes}분` : ""}
                  </span>
                </div>
                <h2 className="mt-2 font-semibold">{quest.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{quest.description}</p>
                {!playable && (
                  <p className="mt-2 text-xs font-medium text-amber-600">준비 중</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/data-source"
        className="mt-8 self-center text-xs text-slate-300 underline underline-offset-2"
      >
        데이터 출처
      </Link>
    </main>
  );
}
