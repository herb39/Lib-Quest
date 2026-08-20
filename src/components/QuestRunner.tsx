"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { QuestSummary } from "@/lib/types";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { DiscoveryCard3D } from "@/components/DiscoveryCard3D";
import { recordDiscovery } from "@/lib/discovery-storage";
import { loadInterestStore, toggleInterest, isInterested, type InterestStore } from "@/lib/interest-storage";
import { saveFinalSelection, getFinalSelection, type FinalSelection } from "@/lib/final-selection-storage";
import { getMissionContent } from "@/lib/mission-content";
import { useRetryingCoverImage } from "@/lib/use-retrying-cover-image";

type FoundBook = {
  id: string;
  title: string;
  author: string | null;
  callNumber: string | null;
  shelfLocation: string | null;
  coverUrl: string | null;
  teaser: string | null;
  hook: string | null;
  question: string | null;
};

type SessionState = {
  currentStep: number; // 0-based index of the step currently in progress
  foundBooks: FoundBook[];
  completedAt: string | null;
  started: boolean;
};

type SuccessInfo = {
  bookId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  teaser: string | null;
  hook: string | null;
  question: string | null;
  isLast: boolean;
  isNew: boolean;
};

// 발견 순간(Discovery)과 책 정보(BookInfo)를 완전히 분리된 화면으로 나눈다 — 인증 직후에는
// 큰 책 오브젝트와 발견 보상만 보여주고, 사용자가 "책 살펴보기"를 눌러야 hook/teaser/question ·
// 읽어보고 싶어요 · 다음 탐사지역 CTA가 있는 정보 화면으로 넘어간다. Next.js route는 늘리지
// 않고 같은 Step 안에서 화면 state만 전환한다(history 추가 없음).
type StepView = "mission" | "discovery" | "bookInfo";

function BookThumb({ coverUrl }: { coverUrl: string | null }) {
  const { status, retryKey, handleLoad, handleError } = useRetryingCoverImage(coverUrl);
  return (
    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-stone-100">
      {coverUrl && status !== "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={retryKey}
          src={coverUrl}
          alt=""
          onError={handleError}
          onLoad={handleLoad}
          loading="eager"
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg text-stone-300" aria-hidden="true">
          📕
        </div>
      )}
    </div>
  );
}

const EMPTY_SESSION: SessionState = { currentStep: 0, foundBooks: [], completedAt: null, started: false };

function sessionKey(questId: string) {
  return `libquest_session_${questId}`;
}

function loadSession(questId: string): SessionState {
  if (typeof window === "undefined") return EMPTY_SESSION;
  try {
    const raw = window.localStorage.getItem(sessionKey(questId));
    if (!raw) return EMPTY_SESSION;
    const parsed = JSON.parse(raw) as Partial<SessionState> & { foundBookIds?: string[] };
    const foundBooks = Array.isArray(parsed.foundBooks) ? parsed.foundBooks : [];
    const currentStep = typeof parsed.currentStep === "number" ? parsed.currentStep : 0;
    const completedAt = parsed.completedAt ?? null;
    // started가 없는 이전 버전 세션(구 foundBookIds 구조 포함)도 이미 진행 중이었다면
    // 탐험 시작 화면을 다시 강제로 보여주지 않는다.
    const started = parsed.started ?? (currentStep > 0 || foundBooks.length > 0 || completedAt !== null);
    return { currentStep, foundBooks, completedAt, started };
  } catch {
    return EMPTY_SESSION;
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
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);
  const [hydrated, setHydrated] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; isMismatch: boolean } | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [stepView, setStepView] = useState<StepView>("mission");
  const [showMoreBookInfo, setShowMoreBookInfo] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [showHint, setShowHint] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [interestStore, setInterestStore] = useState<InterestStore>({ version: 1, bookIds: [] });
  const [finalSelection, setFinalSelection] = useState<FinalSelection | null>(null);

  useEffect(() => {
    // localStorage 기반 익명 세션은 클라이언트에서만 읽을 수 있어 마운트 시 1회 동기화한다.
    const loaded = loadSession(quest.id);
    // 큐레이션이 바뀌어 저장된 단계 인덱스가 더 이상 유효하지 않으면 처음부터 다시 시작한다
    // (그렇지 않으면 존재하지 않는 단계를 기다리며 "불러오는 중..."에서 멈춘다).
    const isValid = loaded.completedAt !== null || loaded.currentStep < quest.steps.length;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(isValid ? loaded : EMPTY_SESSION);
    // 관심 표시/오늘의 한 권 선택은 QuestSession과 완전히 분리된 별도 저장소에서 읽는다.
     
    setInterestStore(loadInterestStore());
     
    setFinalSelection(getFinalSelection(quest.id));
    setHydrated(true);
  }, [quest.id, quest.steps.length]);

  useEffect(() => {
    // 단계가 바뀔 때마다 단계 전용 UI 상태를 초기화한다.
    //
    // 주의: stepView는 여기서 건드리지 않는다. handleVerify가 성공 시 session.currentStep을
    // 이미 다음 단계로 옮겨두고 나서(같은 이벤트 안에서) stepView를 "discovery"로 바꾸는데,
    // 만약 이 effect가 session.currentStep 변경에 반응해 stepView를 "mission"으로 되돌리면
    // 그 즉시 Discovery/BookInfo 화면을 건너뛰고 다음 Step의 Mission 화면으로 넘어가버린다.
    // stepView 전환은 오직 handleVerify(→discovery)/handleExamineBook(→bookInfo)/
    // handleContinue(→mission)에서만 명시적으로 일어난다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowHint(false);
    setFeedback(null);
    setIsbnInput("");
  }, [session.currentStep]);

  const totalSteps = quest.steps.length;
  const isCompleted = session.completedAt !== null;
  const currentStep = quest.steps[session.currentStep];
  const foundBooks = session.foundBooks;

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

  function handleStart() {
    const next: SessionState = { ...session, started: true };
    saveSession(quest.id, next);
    setSession(next);
  }

  function handleContinue() {
    setSuccessInfo(null);
    setStepView("mission");
    setShowMoreBookInfo(false);
  }

  function handleExamineBook() {
    setStepView("bookInfo");
  }

  function handleToggleInterest(bookId: string) {
    const { store } = toggleInterest(bookId);
    setInterestStore(store);
  }

  function handleSelectFinalBook(bookId: string) {
    const selection = saveFinalSelection(quest.id, bookId);
    setFinalSelection(selection);
  }

  // Discovery(발견 순간의 감정적 보상)와 BookInfo(발견 후 독서 관심)를 완전히 분리된 화면으로
  // 보여준다. 세션은 인증 성공 시점에 이미 다음 단계로 넘어가 있지만, 사용자가 "책 살펴보기" →
  // "다음 탐사지역 열기"를 직접 누르기 전까지는 이 두 화면에 머무른다.
  if (successInfo && stepView === "discovery") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 py-8 text-center">
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">새로운 책 발견</p>

        <div
          className="mx-auto mt-4"
          style={{ width: "clamp(220px, 66vw, 300px)", aspectRatio: "2 / 3" }}
        >
          <DiscoveryCard3D
            revealed
            justRevealed
            active
            interactive
            size="hero"
            coverUrl={successInfo.coverUrl}
            title={successInfo.title}
          />
        </div>

        <div role="status" aria-live="polite" className="lq-animate-in mt-5 w-full">
          <h1 className="break-keep text-xl font-bold text-stone-900">{successInfo.title}</h1>
          {successInfo.author && <p className="mt-1 text-sm text-stone-500">{successInfo.author}</p>}

          {successInfo.isNew ? (
            <span className="lq-xp-pop mt-3 inline-block whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              +10 XP
            </span>
          ) : (
            <p className="mt-3 text-xs font-semibold text-stone-400">다시 만난 책</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleExamineBook}
          className="mt-8 flex h-12 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          책 살펴보기 <span aria-hidden="true">→</span>
        </button>
      </main>
    );
  }

  if (successInfo && stepView === "bookInfo") {
    const interested = isInterested(interestStore, successInfo.bookId);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="flex items-center gap-3">
          <div className="h-24 w-16 shrink-0">
            <DiscoveryCard3D
              revealed
              interactive={false}
              size="active"
              caption={false}
              coverUrl={successInfo.coverUrl}
              title={null}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-emerald-700">발견 완료</p>
            <h1 className="mt-0.5 break-keep text-lg font-bold text-stone-900">{successInfo.title}</h1>
            {successInfo.author && <p className="text-sm text-stone-500">{successInfo.author}</p>}
          </div>
        </div>

        {successInfo.hook && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-semibold text-emerald-700">이 책이 끌리는 이유</p>
            <p className="mt-1 break-keep text-base font-semibold text-stone-900">{successInfo.hook}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => handleToggleInterest(successInfo.bookId)}
          className={`mt-3 flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            interested
              ? "border-rose-300 bg-rose-50 text-rose-600"
              : "border-stone-300 bg-white text-stone-600 active:bg-stone-50"
          }`}
        >
          <span aria-hidden="true">{interested ? "♥" : "♡"}</span>
          {interested ? "읽어보고 싶은 책에 담았어요" : "읽어보고 싶어요"}
        </button>

        {(successInfo.teaser || successInfo.question) && (
          <div className="mt-3">
            {!showMoreBookInfo ? (
              <button
                type="button"
                onClick={() => setShowMoreBookInfo(true)}
                className="whitespace-nowrap text-xs font-medium text-stone-500 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                책 더 알아보기
              </button>
            ) : (
              <div className="lq-animate-in rounded-xl bg-stone-50 p-3">
                {successInfo.teaser && (
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400">이런 책이에요</p>
                    <p className="mt-1 break-keep text-sm text-stone-600">{successInfo.teaser}</p>
                  </div>
                )}
                {successInfo.question && (
                  <div className={successInfo.teaser ? "mt-3 border-t border-stone-200 pt-3" : ""}>
                    <p className="text-[11px] font-semibold text-stone-400">책을 펼치기 전에</p>
                    <p className="mt-1 break-keep text-sm text-stone-600">{successInfo.question}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 flex h-12 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {successInfo.isLast ? "결과 카드 보기" : "다음 탐사지역 열기"} <span aria-hidden="true">→</span>
        </button>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-5 py-8 text-sm text-stone-400">
        불러오는 중...
      </main>
    );
  }

  if (isCompleted && !finalSelection) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
          오늘 만난 세 권
        </p>
        <h1 className="mt-1 text-center text-xl font-bold text-stone-900">
          이 중 한 권을 골라볼까요?
        </h1>
        <p className="mt-1 text-center text-sm text-stone-500">오늘 읽고 싶은 책을 선택해주세요.</p>

        <div className="mt-6 flex flex-col gap-3">
          {foundBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleSelectFinalBook(book.id)}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left shadow-sm transition active:scale-[0.99] active:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <BookThumb coverUrl={book.coverUrl} />
              <div className="min-w-0 flex-1">
                <p className="break-keep font-semibold text-stone-900">{book.title}</p>
                {book.author && <p className="text-sm text-stone-500">{book.author}</p>}
              </div>
              <span aria-hidden="true" className="shrink-0 text-stone-300">
                →
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (isCompleted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        {finalSelection && (
          <div className="lq-animate-in mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">오늘의 선택</p>
            {(() => {
              const chosen = foundBooks.find((b) => b.id === finalSelection.bookId);
              if (!chosen) return null;
              return (
                <>
                  <div className="mx-auto mt-2 h-28 w-20">
                    <DiscoveryCard3D revealed coverUrl={chosen.coverUrl} size="active" caption={false} />
                  </div>
                  <h2 className="mt-2 break-keep text-lg font-bold text-stone-900">{chosen.title}</h2>
                  {chosen.hook && <p className="mt-1 break-keep text-sm font-medium text-stone-700">{chosen.hook}</p>}
                  <p className="mt-2 text-xs font-semibold text-amber-700">이제 책을 펼쳐볼까요?</p>
                </>
              );
            })()}
          </div>
        )}

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
            <li key={book.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <BookThumb coverUrl={book.coverUrl} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[11px] font-semibold text-emerald-700">{i + 1}번째 발견</p>
                  <p className="mt-0.5 break-keep font-semibold text-stone-900">{book.title}</p>
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

  if (!session.started) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
        <div className="lq-animate-in rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">오늘의 탐험</p>
          <p className="mt-1 text-xs text-stone-400">{quest.libraryName}</p>
          <h1 className="mt-2 break-keep text-xl font-bold text-stone-900">{quest.title}</h1>
          {quest.theme && (
            <span className="mt-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              {quest.theme}
            </span>
          )}
          <p className="mt-3 break-keep text-sm text-stone-600">{quest.description}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span aria-hidden="true">🧭</span> 총 {totalSteps}개의 미션
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="mt-6 flex h-12 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          탐험 시작하기 <span aria-hidden="true">→</span>
        </button>

        <Link href="/quests" className="mt-3 self-center text-xs text-stone-400">
          ← 퀘스트 목록으로
        </Link>
      </main>
    );
  }

  if (!currentStep) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-5 py-8 text-sm text-stone-400">
        불러오는 중...
      </main>
    );
  }

  // Step 안의 후보 4권은 항상 같은 서가(shelfLocation)/분류(className)를 공유하도록 큐레이션되어
  // 있으므로(청구기호만 후보마다 다름), 첫 번째 후보 값을 Step 전체를 대표하는 탐색 범위로 쓴다.
  const stepClue = currentStep.candidates[0]?.book;
  const mission = getMissionContent(quest.libraryCode, quest.title, currentStep.order);

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

      // 청구기호는 후보마다 달라 인증 전에는 서버가 아예 보내지 않는다(redaction) — 발견 성공 후에만
      // verify 응답(bookCallNumber)에서 받는다. 서가 위치는 Step 전체에 공통이라 화면에 이미 있던
      // 후보 목록에서 그대로 가져온다.
      const matchedCandidate = currentStep.candidates.find((c) => c.book.id === result.bookId);
      const isLastStep = session.currentStep === totalSteps - 1;
      const coverUrl: string | null = result.bookImageUrl ?? null;
      // Discovery Hero가 이 URL로 <img>를 그리기 전에 브라우저 캐시에 먼저 올려 둔다(fire-and-forget —
      // 실패해도 무시, 화면 전환을 기다리게 하지 않는다). 이후 실제 <img>가 같은 URL을 요청하면
      // 캐시 히트로 즉시 표시되어 발견 순간의 깜빡임/지연 체감이 줄어든다.
      if (coverUrl && typeof window !== "undefined") {
        const preload = new window.Image();
        preload.src = coverUrl;
      }
      const foundBook: FoundBook = {
        id: result.bookId,
        title: result.bookTitle,
        author: result.bookAuthor ?? null,
        callNumber: result.bookCallNumber ?? null,
        shelfLocation: matchedCandidate?.book.shelfLocation ?? null,
        coverUrl,
        teaser: result.teaser ?? null,
        hook: result.hook ?? null,
        question: result.question ?? null,
      };
      const next: SessionState = {
        currentStep: isLastStep ? session.currentStep : session.currentStep + 1,
        foundBooks: [...session.foundBooks, foundBook],
        completedAt: isLastStep ? new Date().toISOString() : null,
        started: true,
      };
      saveSession(quest.id, next);
      setFeedback(null);
      setSession(next);

      // QuestSession(진행 상태)과 완전히 분리된 도감(Discovery store)에도 기록한다.
      const { isNew } = recordDiscovery({
        bookId: result.bookId,
        libraryCode: quest.libraryCode,
        questId: quest.id,
        stepId: currentStep.id,
        title: result.bookTitle,
        author: result.bookAuthor ?? null,
        coverUrl,
        className: result.bookClassName ?? null,
        discoveredAt: new Date().toISOString(),
      });
      setSuccessInfo({
        bookId: result.bookId,
        title: result.bookTitle,
        author: result.bookAuthor ?? null,
        coverUrl,
        teaser: result.teaser ?? null,
        hook: result.hook ?? null,
        question: result.question ?? null,
        isLast: isLastStep,
        isNew,
      });
      setStepView("discovery");
    } catch {
      setFeedback({ message: "서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.", isMismatch: false });
    } finally {
      setVerifying(false);
    }
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

      <div className="mt-3">
        <p className="text-center text-[11px] font-medium text-stone-400">이번 탐험의 발견</p>
        <div className="mt-1.5 flex justify-center gap-2">
          {quest.steps.map((s, i) => {
            const found = foundBooks[i];
            const isActive = i === session.currentStep;
            return (
              <div key={s.id} className="h-16 w-11 shrink-0">
                <DiscoveryCard3D
                  revealed={Boolean(found)}
                  coverUrl={found?.coverUrl}
                  title={found?.title}
                  active={isActive}
                  interactive={Boolean(found) || isActive}
                  size="slot"
                />
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-xs font-medium text-stone-400">{quest.libraryName}</p>
      <h1 className="mt-0.5 text-lg font-bold text-stone-900">{quest.title}</h1>

      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-emerald-700">
          MISSION {currentStep.order} / {totalSteps}
        </p>
        <h2 className="mt-1 break-keep text-lg font-bold text-stone-900">
          {mission?.missionTitle ?? "새로운 탐사지역"}
        </h2>
        <p className="mt-1.5 break-keep text-sm text-stone-600">
          {mission?.missionNarrative ?? "이번에는 새로운 책 한 권을 발견해볼까요?"}
        </p>

        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <p className="text-[11px] font-semibold text-stone-400">이번 미션</p>
          <p className="mt-1 break-keep text-sm font-medium text-stone-800">{currentStep.description}</p>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-amber-50 p-3">
          <div className="h-28 w-20 shrink-0">
            <DiscoveryCard3D revealed={false} active interactive size="active" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-800">탐험 단서</p>
            <dl className="mt-1.5 flex flex-col gap-1 text-xs text-stone-600">
              {stepClue?.shelfLocation && (
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true">📍</span>
                  <span className="break-keep">{stepClue.shelfLocation}</span>
                </div>
              )}
              {stepClue?.className && (
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true">📚</span>
                  <span className="break-keep">{stepClue.className}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">🔎</span>
                <span className="whitespace-nowrap">발견 후보 {currentStep.candidates.length}권</span>
              </div>
            </dl>
          </div>
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
        <p className="text-xs font-semibold text-stone-400">책을 발견했다면 인증해주세요</p>

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
              {verifying ? "확인 중..." : "책 발견하기"}
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
