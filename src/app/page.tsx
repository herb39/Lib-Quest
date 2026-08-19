import Link from "next/link";
import { getLibraryList } from "@/lib/data";

// 도서관 목록은 DB 상태를 반영해야 하므로 매 요청마다 조회한다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { libraries } = await getLibraryList();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Lib Quest</p>
      <h1 className="mt-1 text-2xl font-bold leading-snug text-stone-900">
        도서관이 퀘스트가 되는 순간.
      </h1>
      <p className="mt-3 text-sm text-stone-500">오늘은 어떤 도서관을 탐험해볼까요?</p>

      <div className="mt-5 flex flex-col gap-3">
        {libraries.map((lib) => {
          const playable = lib.questCount > 0;
          const card = (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl">
                  📖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold text-stone-900">{lib.name}</h2>
                    {lib.isFeatured && (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        대표 시연
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">{lib.region}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-stone-500">
                  {playable ? `퀘스트 ${lib.questCount}개 이용 가능` : "퀘스트 준비 중"}
                </p>
                {playable && (
                  <span className="text-xs font-semibold text-emerald-700">
                    퀘스트 보기 <span aria-hidden>→</span>
                  </span>
                )}
              </div>
            </>
          );

          if (!playable) {
            return (
              <div
                key={lib.code}
                className="rounded-2xl border border-stone-200 bg-white p-4 opacity-60 shadow-sm"
              >
                {card}
              </div>
            );
          }

          return (
            <Link
              key={lib.code}
              href={`/quests?library=${lib.code}`}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition active:scale-[0.99] active:bg-stone-50"
            >
              {card}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href="/admin/review"
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 active:bg-stone-50"
        >
          운영자 검수
        </Link>
        <Link
          href="/data-source"
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 active:bg-stone-50"
        >
          데이터 출처
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-stone-400">
        실제 소장 도서 데이터를 기반으로 서가를 탐험합니다.
      </p>
    </main>
  );
}
