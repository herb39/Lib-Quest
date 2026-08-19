import Link from "next/link";
import { LIBRARY, QUESTS } from "@/lib/mock-data";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default function QuestsPage() {
  return (
    <main className="flex flex-1 flex-col px-5 py-8">
      <Link href="/" className="text-xs text-slate-400">
        ← {LIBRARY.name}
      </Link>
      <h1 className="mt-2 text-xl font-bold">퀘스트 선택</h1>
      <p className="mt-1 text-sm text-slate-500">
        원하는 퀘스트를 골라 서가 탐험을 시작하세요.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {QUESTS.map((quest) => {
          const playable = quest.steps.length > 0;
          return (
            <li key={quest.id}>
              <Link
                href={playable ? `/quests/${quest.id}` : "#"}
                aria-disabled={!playable}
                className={`block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                  playable ? "active:bg-slate-50" : "pointer-events-none opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {quest.theme}
                  </span>
                  <span className="text-xs text-slate-400">
                    {DIFFICULTY_LABEL[quest.difficulty]} · 약 {quest.estimatedMinutes}분
                  </span>
                </div>
                <h2 className="mt-2 font-semibold">{quest.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{quest.description}</p>
                {!playable && (
                  <p className="mt-2 text-xs font-medium text-amber-600">준비 중</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
