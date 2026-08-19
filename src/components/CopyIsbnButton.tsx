"use client";

import { useState } from "react";

// 발표/개발 환경에서 실제 도서관에 가지 않고도 candidate ISBN을 바로 복사해
// 사용자 퀘스트 화면의 직접 입력으로 테스트할 수 있게 하는 운영자 전용 도구.
export function CopyIsbnButton({ isbn13 }: { isbn13: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(isbn13);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
      >
        복사
      </button>
      {status === "copied" && (
        <span className="text-[11px] text-emerald-600">ISBN을 복사했습니다.</span>
      )}
      {status === "error" && <span className="text-[11px] text-red-500">복사 실패</span>}
    </span>
  );
}
