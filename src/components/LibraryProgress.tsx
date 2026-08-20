"use client";

import { useEffect, useState } from "react";
import { loadDiscoveryStore, getLibraryDiscoveryCount } from "@/lib/discovery-storage";

// 도서관 카드의 "3 / 36 발견" 표시. 분모(bookCount)는 서버에서 계산한 실제 Book 수를 그대로
// props로 받고, 분자(발견 수)만 localStorage 도감에서 클라이언트 마운트 후에 읽는다
// (SSR과 첫 클라이언트 렌더가 항상 동일해야 hydration mismatch가 나지 않는다).
export function LibraryProgress({ libraryCode, bookCount }: { libraryCode: string; bookCount: number }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(getLibraryDiscoveryCount(loadDiscoveryStore(), libraryCode));
  }, [libraryCode]);

  if (count === null || bookCount === 0) return null;

  const pct = Math.min(100, Math.round((count / bookCount) * 100));

  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-stone-400">
        {count} / {bookCount} 발견
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
