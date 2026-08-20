"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDiscoveryStore, getUniqueDiscoveryCount, getXp, getExplorerTitle } from "@/lib/discovery-storage";

// 홈 화면의 "나의 탐험" 요약. 도감(Discovery store)은 localStorage 전용이라
// 마운트 이전에는 서버와 동일하게 빈 상태로 그려 hydration mismatch를 피한다.
export function MyExploration() {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    const store = loadDiscoveryStore();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(getUniqueDiscoveryCount(store));
     
    setXp(getXp(store));
    setMounted(true);
  }, []);

  return (
    <div className="min-h-[92px] rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-stone-400">나의 탐험</p>
      {!mounted ? null : count === 0 ? (
        <>
          <p className="mt-1.5 text-sm text-stone-600">아직 발견한 책이 없어요.</p>
          <p className="text-xs text-stone-400">첫 번째 퀘스트를 시작해볼까요?</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-base font-bold text-stone-900">{getExplorerTitle(xp)}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-stone-600">
            <span className="whitespace-nowrap">⭐ {xp} XP</span>
            <span className="whitespace-nowrap">📚 발견한 책 {count}권</span>
          </div>
        </>
      )}
      {mounted && (
        <Link href="/discoveries" className="mt-3 inline-block whitespace-nowrap text-xs font-semibold text-emerald-700">
          발견 도감 보기 <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
