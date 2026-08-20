"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DiscoveryCard3D } from "@/components/DiscoveryCard3D";
import {
  loadDiscoveryStore,
  resetDiscoveryStore,
  getUniqueDiscoveryCount,
  getXp,
  getExplorerTitle,
  getLibraryDiscoveryCount,
  type DiscoveryStore,
} from "@/lib/discovery-storage";

type LibraryInfo = { code: string; name: string; bookCount: number };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function DiscoveriesView({ libraries }: { libraries: LibraryInfo[] }) {
  const [mounted, setMounted] = useState(false);
  const [store, setStore] = useState<DiscoveryStore>({ version: 1, discoveries: [] });
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loadDiscoveryStore());
    setMounted(true);
  }, []);

  const totalBookCount = libraries.reduce((sum, l) => sum + l.bookCount, 0);
  const uniqueCount = getUniqueDiscoveryCount(store);
  const xp = getXp(store);
  const title = getExplorerTitle(xp);

  const visible =
    filter === "all" ? store.discoveries : store.discoveries.filter((d) => d.libraryCode === filter);

  function libraryName(code: string) {
    return libraries.find((l) => l.code === code)?.name ?? code;
  }

  function handleReset() {
    if (!window.confirm("발견 기록을 정말 초기화할까요? 이 동작은 되돌릴 수 없어요.")) return;
    setStore(resetDiscoveryStore());
  }

  if (!mounted) {
    return <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8" />;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Link href="/" className="text-xs text-stone-400">
        ← 홈
      </Link>

      <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-stone-400">나의 발견</p>
        <h1 className="mt-1 text-xl font-bold text-stone-900">{title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm font-semibold text-stone-600">
          <span className="whitespace-nowrap">⭐ {xp} XP</span>
          <span className="whitespace-nowrap">
            📚 {uniqueCount} / {totalBookCount} 발견
          </span>
        </div>
      </div>

      {libraries.length > 1 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium text-stone-400">도서관별 진행도</p>
          <div className="flex flex-col gap-1.5">
            {libraries.map((lib) => {
              const count = getLibraryDiscoveryCount(store, lib.code);
              const pct = lib.bookCount > 0 ? Math.min(100, Math.round((count / lib.bookCount) * 100)) : 0;
              return (
                <div key={lib.code} className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="w-20 shrink-0 truncate">{lib.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 shrink-0 whitespace-nowrap text-right">
                    {count}/{lib.bookCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
            filter === "all" ? "bg-emerald-600 text-white" : "border border-stone-300 text-stone-600"
          }`}
        >
          전체
        </button>
        {libraries.map((lib) => (
          <button
            key={lib.code}
            type="button"
            onClick={() => setFilter(lib.code)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === lib.code ? "bg-emerald-600 text-white" : "border border-stone-300 text-stone-600"
            }`}
          >
            {lib.name}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-400">
          아직 이 조건으로 발견한 책이 없어요.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {visible.map((d) => (
            <div key={d.bookId} className="rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
              <div className="h-36 w-full">
                <DiscoveryCard3D revealed coverUrl={d.coverUrl} title={d.title} size="grid" />
              </div>
              <div className="mt-1.5">
                {d.author && <p className="truncate text-xs text-stone-500">{d.author}</p>}
                {d.className && <p className="truncate text-[10px] text-stone-400">{d.className}</p>}
                <p className="mt-0.5 truncate text-[10px] text-stone-400">
                  {libraryName(d.libraryCode)} · {formatDate(d.discoveredAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleReset}
        className="mt-10 self-center whitespace-nowrap text-xs text-stone-300 underline underline-offset-2"
      >
        발견 기록 초기화
      </button>
    </main>
  );
}
