import Link from "next/link";
import { getLibraryList } from "@/lib/data";

// 도서관 목록은 DB 상태를 반영해야 하므로 매 요청마다 조회한다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { libraries } = await getLibraryList();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <h1 className="text-2xl font-bold leading-snug">
        대전의 도서관에서
        <br />새로운 책을 발견해보세요.
      </h1>

      <p className="mt-4 text-sm text-slate-500">이용할 도서관을 선택하세요.</p>

      <div className="mt-4 flex flex-col gap-3">
        {libraries.map((lib) => {
          const playable = lib.questCount > 0;
          return (
            <div
              key={lib.code}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{lib.name}</h2>
                {lib.isFeatured && (
                  <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
                    대표 시연
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{lib.region}</p>
              <p className="mt-1 text-xs text-slate-400">
                {playable ? `퀘스트 ${lib.questCount}개 이용 가능` : "퀘스트 준비 중"}
              </p>

              <Link
                href={playable ? `/quests?library=${lib.code}` : "#"}
                aria-disabled={!playable}
                className={`mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold ${
                  playable
                    ? "bg-slate-900 text-white active:bg-slate-800"
                    : "pointer-events-none bg-slate-100 text-slate-400"
                }`}
              >
                퀘스트 보기
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href="/admin/review"
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          운영자 검수
        </Link>
        <Link
          href="/data-source"
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          데이터 출처
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        실제 소장 도서 데이터를 기반으로 서가를 탐험합니다.
      </p>
    </main>
  );
}
