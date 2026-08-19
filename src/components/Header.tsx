"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 모든 주요 화면에서 홈으로 쉽게 돌아갈 수 있도록 하는 공통 헤더.
// 퀘스트 진행 화면의 모바일 UX를 방해하지 않도록 높이를 작게 유지한다.
export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-stone-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
          <span aria-hidden>📚</span> Lib Quest
        </Link>
        {!isHome && (
          <Link
            href="/"
            className="rounded-full px-2 py-1 text-xs font-semibold text-emerald-700 active:bg-emerald-50"
          >
            홈
          </Link>
        )}
      </div>
    </header>
  );
}
