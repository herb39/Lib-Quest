import Link from "next/link";
import { LIBRARY_CODE, LIBRARY_NAME } from "@/lib/config";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-8">
      <div>
        <h1 className="mt-2 text-2xl font-bold leading-snug">
          서가를 걸으며
          <br />책을 발견하는 여정
        </h1>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-slate-400">대표 도서관</p>
        <h2 className="mt-1 text-lg font-semibold">{LIBRARY_NAME}</h2>
        <p className="mt-1 text-xs text-slate-400">libCode {LIBRARY_CODE}</p>

        <Link
          href="/quests"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white active:bg-slate-800"
        >
          퀘스트 보러가기
        </Link>
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
