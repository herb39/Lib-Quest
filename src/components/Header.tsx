"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 모든 주요 화면에서 홈으로 쉽게 돌아갈 수 있도록 하는 공통 헤더.
// 퀘스트 진행 화면의 모바일 UX를 방해하지 않도록 높이를 작게 유지한다.
export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-bold text-slate-900">
          Lib Quest
        </Link>
        {!isHome && (
          <Link href="/" className="text-xs font-medium text-slate-500 active:text-slate-700">
            홈
          </Link>
        )}
      </div>
    </header>
  );
}
