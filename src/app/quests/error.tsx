"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function QuestsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // DB 연결 실패 등 원인 파악용 서버 로그. 민감정보(연결 문자열 등)는 남기지 않는다.
    console.error("[quests] failed to load", { name: error.name, message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-700">데이터를 불러오지 못했습니다.</p>
      <p className="mt-1 text-sm text-slate-500">잠시 후 다시 시도해 주세요.</p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white active:bg-slate-800"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="flex h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
