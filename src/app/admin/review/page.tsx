import Link from "next/link";
import { DEFAULT_LIBRARY_CODE } from "@/lib/config";
import { getAdminReviewData } from "@/lib/admin-data";
import { CopyIsbnButton } from "@/components/CopyIsbnButton";

// 발표용 읽기 전용 검수 화면. 사서/운영자/발표자가 PC로 보는 화면이므로
// desktop-first(넓은 content width)로 구성한다. 로그인/권한/CRUD 없음.
export const dynamic = "force-dynamic";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <h1 className="text-xl font-bold">운영자 검수</h1>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          DB(DATABASE_URL)가 설정되지 않아 검수 데이터를 표시할 수 없습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <h1 className="text-xl font-bold">운영자 검수</h1>
      <p className="mt-1 text-sm text-slate-500">
        실제 후보 도서와 위치 정보를 확인하는 읽기 전용 화면입니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {data.libraryOptions.map((opt) => (
          <Link
            key={opt.code}
            href={`/admin/review?library=${opt.code}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              opt.code === data.library.code
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {opt.name}
          </Link>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">선택한 도서관</p>
        <p className="mt-1 font-semibold">
          {data.library.name} <span className="font-normal text-slate-400">libCode {data.library.code}</span>
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "퀘스트", value: `${data.quests.length}개` },
            { label: "단계", value: `${data.stepCount}개` },
            { label: "후보 도서", value: `${data.candidateCount}개` },
            { label: "실제 활용 도서", value: `${data.bookCount}권` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        {data.quests.map((quest, qi) => (
          <section key={qi} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

            <div className="mt-4 flex flex-col gap-5">
              {quest.steps.map((step) => (
                <div key={step.order}>
                  <p className="text-xs font-semibold text-slate-500">
                    {step.order}단계 · {step.title}
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full min-w-[880px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-400">
                          <th className="py-2 pl-3 pr-2">대표</th>
                          <th className="py-2 pr-2">제목</th>
                          <th className="py-2 pr-2">저자</th>
                          <th className="py-2 pr-2">ISBN</th>
                          <th className="py-2 pr-2">KDC</th>
                          <th className="py-2 pr-2">분류명</th>
                          <th className="py-2 pr-2">청구기호</th>
                          <th className="py-2 pr-2">자료실/서가</th>
                          <th className="py-2 pr-3">데이터 출처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step.candidates.map((c) => (
                          <tr key={c.book.isbn13} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pl-3 pr-2">
                              {c.isPrimary && (
                                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  대표
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-2 font-medium">{c.book.title}</td>
                            <td className="py-2 pr-2 text-slate-500">{c.book.author ?? "-"}</td>
                            <td className="py-2 pr-2">
                              <span className="inline-flex items-center gap-1.5 font-mono text-slate-600">
                                {c.book.isbn13}
                                <CopyIsbnButton isbn13={c.book.isbn13} />
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-slate-500">{c.book.classNo ?? "-"}</td>
                            <td className="py-2 pr-2 text-slate-500">{c.book.className ?? "-"}</td>
                            <td className="py-2 pr-2 text-slate-500">{c.book.callNumber ?? "-"}</td>
                            <td className="py-2 pr-2 text-slate-500">{c.book.shelfLocation ?? "-"}</td>
                            <td className="py-2 pr-3 text-slate-500">{c.book.source}</td>
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
