"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BookSummary, QuestSummary } from "@/lib/types";

type SessionState = {
  currentStep: number; // 0-based index of the step currently in progress
  foundBookIds: string[];
  completedAt: string | null;
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

export function QuestRunner({ quest }: { quest: QuestSummary }) {
  const [session, setSession] = useState<SessionState>({
    currentStep: 0,
    foundBookIds: [],
    completedAt: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
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

  if (isCompleted) {
    return (
      <main className="flex flex-1 flex-col px-5 py-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-xs font-semibold text-emerald-600">퀘스트 완료</p>
          <h1 className="mt-2 text-xl font-bold">{quest.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            총 {totalSteps}단계에서 {foundBooks.length}권의 책을 발견했어요.
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {foundBooks.map((book, i) => (
            <li key={book.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400">{i + 1}단계에서 발견</p>
              <p className="mt-1 font-semibold">{book.title}</p>
              <p className="text-sm text-slate-500">{book.author}</p>
              <p className="mt-1 text-xs text-slate-400">{book.callNumber} · {book.shelfLocation}</p>
            </li>
          ))}
        </ul>

        <Link
          href="/quests"
          className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white active:bg-slate-800"
        >
          다른 퀘스트 보기
        </Link>
      </main>
    );
  }

  if (!hydrated || !currentStep) {
    return <main className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-slate-400">불러오는 중...</main>;
  }

  const candidate = currentStep.candidates[candidateIndex];

  async function handleVerify() {
    if (!isbnInput.trim()) {
      setFeedback({ type: "error", message: "ISBN을 입력하거나 스캔해주세요." });
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
        setFeedback({ type: "error", message: result.message ?? "확인할 수 없어요. 다시 시도해주세요." });
        return;
      }

      const isLastStep = session.currentStep === totalSteps - 1;
      const next: SessionState = {
        currentStep: isLastStep ? session.currentStep : session.currentStep + 1,
        foundBookIds: [...session.foundBookIds, result.bookId as string],
        completedAt: isLastStep ? new Date().toISOString() : null,
      };
      saveSession(quest.id, next);
      setFeedback({ type: "success", message: `"${result.bookTitle}" 확인 완료!` });
      setSession(next);
    } catch {
      setFeedback({ type: "error", message: "서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요." });
    } finally {
      setVerifying(false);
    }
  }

  function handleShowAnother() {
    setCandidateIndex((i) => (i + 1) % currentStep.candidates.length);
  }

  return (
    <main className="flex flex-1 flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/quests" className="text-xs text-slate-400">
          ← 퀘스트 목록
        </Link>
        <span className="text-xs font-medium text-slate-400">
          {session.currentStep + 1} / {totalSteps} 단계
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${((session.currentStep) / totalSteps) * 100}%` }}
        />
      </div>

      <h1 className="mt-5 text-lg font-bold">{quest.title}</h1>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">{currentStep.order}단계 미션</p>
        <h2 className="mt-1 font-semibold">{currentStep.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{currentStep.description}</p>

        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="mt-3 text-xs font-medium text-slate-500 underline underline-offset-2"
        >
          {showHint ? "힌트 숨기기" : "힌트 보기"}
        </button>
        {showHint && <p className="mt-2 text-xs text-slate-500">{currentStep.hint}</p>}
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">서가 안내</p>
        <p className="mt-1 text-sm font-semibold">{candidate.book.shelfLocation}</p>
        <p className="text-sm text-slate-500">청구기호 {candidate.book.callNumber}</p>
        {currentStep.candidates.length > 1 && (
          <button
            type="button"
            onClick={handleShowAnother}
            className="mt-3 text-xs font-medium text-slate-500 underline underline-offset-2"
          >
            다른 책 보기 ({candidateIndex + 1}/{currentStep.candidates.length})
          </button>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">ISBN 확인</p>
        <p className="mt-1 text-xs text-slate-400">
          책 뒷면의 바코드를 스캔하거나 ISBN을 직접 입력하세요.
        </p>

        <IsbnScanButton onScanned={(value) => setIsbnInput(value)} />

        <div className="mt-3 flex gap-2">
          <input
            value={isbnInput}
            onChange={(e) => setIsbnInput(e.target.value)}
            inputMode="numeric"
            placeholder="ISBN-13 (예: 9788936434120)"
            className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white active:bg-slate-800 disabled:opacity-60"
          >
            {verifying ? "확인 중..." : "확인"}
          </button>
        </div>

        {feedback && (
          <p
            className={`mt-3 text-sm font-medium ${
              feedback.type === "success" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </section>
    </main>
  );
}

function IsbnScanButton({ onScanned }: { onScanned: (isbn: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // BarcodeDetector 지원 여부는 클라이언트 런타임에서만 판단할 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  async function startScan() {
    setScanning(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["ean_13"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const stop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setScanning(false);
      };

      const tick = async () => {
        if (video.readyState < 2) {
          requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            onScanned(codes[0].rawValue);
            stop();
            return;
          }
        } catch {
          // detect가 일시적으로 실패해도 계속 시도
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      setTimeout(stop, 15000);
    } catch {
      setScanning(false);
    }
  }

  if (supported === false) {
    return (
      <p className="mt-2 text-xs text-amber-600">
        이 브라우저는 카메라 바코드 인식을 지원하지 않아요. 아래에 ISBN을 직접 입력해주세요.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={startScan}
      disabled={scanning}
      className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-60"
    >
      {scanning ? "스캔 중... (카메라를 바코드에 비춰주세요)" : "카메라로 바코드 스캔"}
    </button>
  );
}
