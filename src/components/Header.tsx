"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resetLibQuestUserState } from "@/lib/reset-user-state";

// 모든 주요 화면에서 홈으로 쉽게 돌아갈 수 있도록 하는 공통 헤더.
// 퀘스트 진행 화면의 모바일 UX를 방해하지 않도록 높이를 작게 유지한다.
export function Header() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const [confirming, setConfirming] = useState(false);

  function handleReset() {
    resetLibQuestUserState();
    setConfirming(false);
    // 화면 메모리에 남아있는 이전 state까지 확실히 비우기 위해 클라이언트 라우팅이 아니라
    // 완전한 새로고침으로 홈에 진입한다 — 발표 중 새 사용자 상태를 가장 확실하게 보여주는 방법.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-stone-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
            <span aria-hidden>📚</span> Lib Quest
          </Link>
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold text-stone-500 active:bg-stone-100"
            >
              <span aria-hidden="true">↻</span> 처음부터
            </button>
          )}
        </div>
      </header>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-5"
        >
          <div className="lq-animate-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h2 id="reset-dialog-title" className="break-keep text-lg font-bold text-stone-900">
              탐험을 처음부터 시작할까요?
            </h2>
            <p className="mt-2 break-keep text-sm text-stone-500">
              발견한 책, XP, 관심 표시와 진행 중인 퀘스트 기록이 이 브라우저에서 모두 초기화됩니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 flex-1 whitespace-nowrap rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 active:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="h-11 flex-1 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                처음부터 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
