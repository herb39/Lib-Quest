"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BookSummary, QuestSummary } from "@/lib/types";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type SessionState = {
  currentStep: number; // 0-based index of the step currently in progress
  foundBookIds: string[];
  completedAt: string | null;
};

type SuccessInfo = {
  title: string;
  author: string | null;
  isLast: boolean;
};

function sessionKey(questId: string) {
  return `libquest_session_${questId}`;
}

function loadSession(questId: string): SessionState {
  if (typeof window === "undefined") {
    return { currentStep: 0, foundBookIds: [], completedAt: null };
  }
  try {
    const raw = window.localStorage.getItem(sessionKey(questId));
    if (!raw) return { currentStep: 0, foundBookIds: [], completedAt: null };
    return JSON.parse(raw) as SessionState;
  } catch {
    return { currentStep: 0, foundBookIds: [], completedAt: null };
  }
}

function saveSession(questId: string, state: SessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionKey(questId), JSON.stringify(state));
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <div key={i} className="flex items-center">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                state === "done"
                  ? "bg-emerald-600 text-white"
                  : state === "current"
                    ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500"
                    : "bg-stone-200 text-stone-400"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            {i < total - 1 && (
              <span className={`h-px w-4 ${i < current ? "bg-emerald-400" : "bg-stone-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuestRunner({ quest }: { quest: QuestSummary }) {
  const [session, setSession] = useState<SessionState>({
    currentStep: 0,
    foundBookIds: [],
    completedAt: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; isMismatch: boolean } | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [showHint, setShowHint] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // localStorage 기반 익명 세션은 클라이언트에서만 읽을 수 있어 마운트 시 1회 동기화한다.
    const loaded = loadSession(quest.id);
    // 큐레이션이 바뀌어 저장된 단계 인덱스가 더 이상 유효하지 않으면 처음부터 다시 시작한다
    // (그렇지 않으면 존재하지 않는 단계를 기다리며 "불러오는 중..."에서 멈춘다).
    const isValid = loaded.completedAt !== null || loaded.currentStep < quest.steps.length;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(isValid ? loaded : { currentStep: 0, foundBookIds: [], completedAt: null });
    setHydrated(true);
  }, [quest.id, quest.steps.length]);

  useEffect(() => {
    // 단계가 바뀔 때마다 단계 전용 UI 상태를 초기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCandidateIndex(0);
    setShowHint(false);
    setFeedback(null);
    setIsbnInput("");
  }, [session.currentStep]);

  const totalSteps = quest.steps.length;
  const isCompleted = session.completedAt !== null;
  const currentStep = quest.steps[session.currentStep];
  const foundBooks: BookSummary[] = useMemo(() => {
    const all = quest.steps.flatMap((s) => s.candidates.map((c) => c.book));
    return session.foundBookIds
      .map((id) => all.find((b) => b.id === id))
      .filter((b): b is BookSummary => Boolean(b));
  }, [quest.steps, session.foundBookIds]);

  async function handleShare() {
    const shareText = `Lib Quest에서 '${quest.title}' 퀘스트를 완료하고 책 ${foundBooks.length}권을 발견했어요.`;
    const shareUrl = "https://quest.lib.lc";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Lib Quest", text: shareText, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 1500);
    } catch {
      // 공유 취소, 클립보드 미지원 등은 조용히 무시한다.
    }
  }

  function handleContinue() {
    setSuccessInfo(null);
  }

  // 성공 직후에는 세션이 이미 다음 단계로 넘어가 있어도, 사용자가 "다음 미션"을 눌러
  // 직접 화면을 넘기기 전까지는 발표자가 결과를 보여줄 수 있도록 성공 패널을 유지한다.
  if (successInfo) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div
          role="status"
          aria-live="polite"
          className="lq-animate-in w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
        >
          <div
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
          >
            ✓
          </div>
          <p className="mt-3 text-sm font-semibold text-emerald-700">책을 발견했어요!</p>
          <h2 className="mt-1 break-keep text-lg font-bold text-stone-900">{successInfo.title}</h2>
          {successInfo.author && <p className="mt-0.5 text-sm text-stone-500">{successInfo.author}</p>}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 flex h-12 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {successInfo.isLast ? "결과 카드 보기" : "다음 미션"} <span aria-hidden="true">→</span>
        </button>
      </main>
    );
  }

  if (isCompleted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="lq-animate-in rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p aria-hidden="true" className="text-3xl">
            🎉
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {quest.libraryName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">퀘스트 완료!</h1>
          <p className="mt-1 text-sm text-stone-600">{quest.title}</p>
          <p className="mt-3 text-sm text-stone-600">새로운 책 {foundBooks.length}권을 발견했어요.</p>

          <div className="mt-4 flex justify-center gap-8">
            <div>
              <p className="text-lg font-bold text-stone-900">{totalSteps}</p>
              <p className="text-xs text-stone-500">완료한 미션</p>
            </div>
            <div>
              <p className="text-lg font-bold text-stone-900">{foundBooks.length}</p>
              <p className="text-xs text-stone-500">발견한 책</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5">
          {quest.steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 shadow-sm">
                {s.title}
              </span>
              {i < quest.steps.length - 1 && (
                <span aria-hidden="true" className="text-stone-300">
                  →
                </span>
              )}
            </span>
          ))}
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {foundBooks.map((book, i) => (
            <li key={book.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-keep font-semibold text-stone-900">{book.title}</p>
                  {book.author && <p className="text-sm text-stone-500">{book.author}</p>}
                  {(book.callNumber || book.shelfLocation) && (
                    <p className="mt-1 break-keep text-xs text-stone-400">
                      {[book.callNumber, book.shelfLocation].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-2">
          <Link
            href={`/quests?library=${quest.libraryCode}`}
            className="flex h-12 w-full items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            다른 퀘스트 도전하기
          </Link>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center whitespace-nowrap rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 active:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            다른 도서관 둘러보기
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="mt-1 flex h-10 w-full items-center justify-center whitespace-nowrap text-xs font-semibold text-stone-500 active:text-stone-700"
          >
            {shareStatus === "copied" ? "링크를 복사했어요" : "결과 공유하기"}
          </button>
        </div>
      </main>
    );
  }

  if (!hydrated || !currentStep) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-5 py-8 text-sm text-stone-400">
        불러오는 중...
      </main>
    );
  }

  const candidate = currentStep.candidates[candidateIndex];

  async function handleVerify() {
    if (!isbnInput.trim()) {
      setFeedback({ message: "ISBN을 입력하거나 스캔해주세요.", isMismatch: false });
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/quests/${quest.id}/steps/${currentStep.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isbn13: isbnInput }),
      });
      const result = await res.json();

      if (!result.success) {
        setFeedback({
          message: result.message ?? "확인할 수 없어요. 다시 시도해주세요.",
          isMismatch: true,
        });
        return;
      }

      const isLastStep = session.currentStep === totalSteps - 1;
      const next: SessionState = {
        currentStep: isLastStep ? session.currentStep : session.currentStep + 1,
        foundBookIds: [...session.foundBookIds, result.bookId as string],
        completedAt: isLastStep ? new Date().toISOString() : null,
      };
      saveSession(quest.id, next);
      setFeedback(null);
      setSession(next);
      setSuccessInfo({ title: result.bookTitle, author: result.bookAuthor ?? null, isLast: isLastStep });
    } catch {
      setFeedback({ message: "서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.", isMismatch: false });
    } finally {
      setVerifying(false);
    }
  }

  function handleShowAnother() {
    setCandidateIndex((i) => (i + 1) % currentStep.candidates.length);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/quests" className="text-xs text-stone-400">
          ← 퀘스트 목록
        </Link>
        <span className="text-xs font-semibold text-stone-500">
          STEP {session.currentStep + 1} / {totalSteps}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <StepDots total={totalSteps} current={session.currentStep} />
      </div>

      {foundBooks.length > 0 && (
        <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {foundBooks.map((b) => (
            <li key={b.id} className="flex max-w-[9.5rem] items-center gap-1 text-xs text-stone-400">
              <span aria-hidden="true" className="text-emerald-600">
                ✓
              </span>
              <span className="truncate">{b.title}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-xs font-medium text-stone-400">{quest.libraryName}</p>
      <h1 className="mt-0.5 text-lg font-bold text-stone-900">{quest.title}</h1>

      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-emerald-700">STEP {currentStep.order}</p>
        <h2 className="mt-1 text-base font-bold text-stone-900">{currentStep.title}</h2>
        <p className="mt-1.5 text-sm text-stone-600">{currentStep.description}</p>

        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-800">
            <span aria-hidden="true">📍</span> 찾아갈 곳
          </p>
          <p className="mt-0.5 break-keep text-sm font-medium text-stone-800">
            {candidate.book.shelfLocation ?? "서가 정보 없음"}
          </p>
          {candidate.book.callNumber && (
            <p className="mt-0.5 whitespace-nowrap text-xs text-stone-500">
              청구기호 <span className="font-mono">{candidate.book.callNumber}</span>
            </p>
          )}
          {currentStep.candidates.length > 1 && (
            <button
              type="button"
              onClick={handleShowAnother}
              className="mt-2 whitespace-nowrap text-xs font-medium text-amber-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              다른 책 보기 ({candidateIndex + 1}/{currentStep.candidates.length})
            </button>
          )}
        </div>

        {currentStep.hint && (
          <>
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="mt-3 whitespace-nowrap text-xs font-medium text-stone-500 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {showHint ? "힌트 숨기기" : "힌트 보기"}
            </button>
            {showHint && <p className="mt-2 text-xs text-stone-500">{currentStep.hint}</p>}
          </>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-stone-400">책을 찾았다면 확인해주세요</p>

        {/* key로 단계마다 새 인스턴스를 만들어 단계 이동 시 이전 카메라 스트림이 확실히 종료되게 한다. */}
        <BarcodeScanner key={currentStep.id} onScanned={(value) => setIsbnInput(value)} />

        <div className="mt-4">
          <p className="text-xs font-medium text-stone-400">또는 ISBN 직접 입력</p>
          <div className="mt-1.5 flex gap-2">
            <input
              value={isbnInput}
              onChange={(e) => setIsbnInput(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="ISBN-13 (예: 9788936434120)"
              aria-label="ISBN 13자리 직접 입력"
              className="h-11 flex-1 rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="h-11 shrink-0 whitespace-nowrap rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white transition active:bg-stone-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {verifying ? "확인 중..." : "확인"}
            </button>
          </div>
        </div>

        {feedback && (
          <p
            role="alert"
            className="mt-3 break-keep rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
          >
            {feedback.message}
            {feedback.isMismatch && (
              <>
                <br />
                <span className="font-normal text-rose-500">다른 책을 찾아볼까요?</span>
              </>
            )}
          </p>
        )}
      </section>
    </main>
  );
}
