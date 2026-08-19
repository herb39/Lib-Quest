import Link from "next/link";
import { getAdminReviewData } from "@/lib/admin-data";

// 발표용 읽기 전용 검수 화면. 로그인/권한/CRUD 없음. 실데이터를 항상 DB에서 조회한다.
export const dynamic = "force-dynamic";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default async function AdminReviewPage() {
  const data = await getAdminReviewData();

  if (!data.available) {
    return (
      <main className="mx-auto flex max-w-3xl flex-1 flex-col px-5 py-8">
        <h1 className="text-xl font-bold">운영자 검수</h1>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          DB(DATABASE_URL)가 설정되지 않아 검수 데이터를 표시할 수 없습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col px-5 py-8">
      <Link href="/" className="text-xs text-slate-400">
        ← 홈
      </Link>
      <h1 className="mt-2 text-xl font-bold">운영자 검수</h1>
      <p className="mt-1 text-sm text-slate-500">
        실제 후보 도서와 위치 정보를 확인하는 읽기 전용 화면입니다.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">대표 도서관</p>
        <p className="mt-1 font-semibold">{data.library.name}</p>
        <p className="text-sm text-slate-500">
          libCode {data.library.code} · 도서 {data.bookCount}권 · 퀘스트 {data.quests.length}개
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        {data.quests.map((quest, qi) => (
          <section key={qi} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{quest.title}</h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  quest.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {quest.published ? "게시됨" : "미게시"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {quest.theme} · {quest.difficulty ? DIFFICULTY_LABEL[quest.difficulty] : "-"}
            </p>

            <div className="mt-4 flex flex-col gap-4">
              {quest.steps.map((step) => (
                <div key={step.order}>
                  <p className="text-xs font-semibold text-slate-500">
                    {step.order}단계 · {step.title}
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-400">
                          <th className="py-1 pr-2">제목</th>
                          <th className="py-1 pr-2">저자</th>
                          <th className="py-1 pr-2">ISBN</th>
                          <th className="py-1 pr-2">KDC</th>
                          <th className="py-1 pr-2">청구기호</th>
                          <th className="py-1 pr-2">서가위치</th>
                          <th className="py-1 pr-2">출처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step.candidates.map((c) => (
                          <tr key={c.book.isbn13} className="border-b border-slate-100">
                            <td className="py-1 pr-2">
                              {c.book.title}
                              {c.isPrimary && (
                                <span className="ml-1 rounded bg-slate-900 px-1 py-0.5 text-[10px] text-white">
                                  대표
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-2 text-slate-500">{c.book.author ?? "-"}</td>
                            <td className="py-1 pr-2 font-mono text-slate-500">{c.book.isbn13}</td>
                            <td className="py-1 pr-2 text-slate-500">
                              {c.book.classNo ?? "-"}
                              {c.book.className ? ` (${c.book.className})` : ""}
                            </td>
                            <td className="py-1 pr-2 text-slate-500">{c.book.callNumber ?? "-"}</td>
                            <td className="py-1 pr-2 text-slate-500">{c.book.shelfLocation ?? "-"}</td>
                            <td className="py-1 pr-2 text-slate-500">{c.book.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Link href="/data-source" className="mt-6 text-xs text-slate-400 underline underline-offset-2">
        데이터 출처 보기
      </Link>
    </main>
  );
}
