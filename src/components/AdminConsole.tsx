"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyIsbnButton } from "@/components/CopyIsbnButton";
import type { AdminQuest, AdminStep, AdminCandidate, ReviewStatusValue } from "@/lib/admin-data";

const STATUS_LABEL: Record<ReviewStatusValue, string> = {
  DRAFT: "초안",
  REVIEW_NEEDED: "검수 필요",
  APPROVED: "검수 완료",
};

const STATUS_STYLE: Record<ReviewStatusValue, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  REVIEW_NEEDED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ status }: { status: ReviewStatusValue }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function PublishBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isPublished ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {isPublished ? "공개" : "비공개"}
    </span>
  );
}

type SaveMessage = { type: "success" | "error"; text: string } | null;

async function patchJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok && data.success, data };
}

// Mission Content 편집기. 저장/검수 필요/검수 완료/공개/비공개 5개 버튼이 전부 (missionTitle,
// missionNarrative) 현재 textarea 값 + 해당 액션의 상태 변경을 함께 보낸다 — "저장"만 누르고
// 다른 버튼을 눌러도 방금 입력한 내용을 잃지 않게 하기 위함이다.
function MissionEditor({ step }: { step: AdminStep }) {
  const [missionTitle, setMissionTitle] = useState(step.mission.missionTitle ?? "");
  const [missionNarrative, setMissionNarrative] = useState(step.mission.missionNarrative ?? "");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusValue>(step.mission.reviewStatus);
  const [isPublished, setIsPublished] = useState(step.mission.isPublished);
  const [exists, setExists] = useState(step.mission.exists);
  const [savedTitle, setSavedTitle] = useState(step.mission.missionTitle ?? "");
  const [savedNarrative, setSavedNarrative] = useState(step.mission.missionNarrative ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  const dirty = missionTitle !== savedTitle || missionNarrative !== savedNarrative;

  async function run(extra: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    const { ok, data } = await patchJson(`/api/admin/mission-contents/${step.id}`, {
      missionTitle,
      missionNarrative,
      ...extra,
    });
    if (ok) {
      setReviewStatus(data.mission.reviewStatus);
      setIsPublished(data.mission.isPublished);
      setExists(true);
      setSavedTitle(missionTitle);
      setSavedNarrative(missionNarrative);
      setMessage({ type: "success", text: "저장됐어요." });
    } else {
      setMessage({ type: "error", text: data.message ?? "저장하지 못했어요. 다시 시도해주세요." });
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-500">Mission Content</p>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={reviewStatus} />
          <PublishBadge isPublished={isPublished} />
          {!exists && <span className="text-[11px] text-stone-400">(아직 DB에 콘텐츠 없음)</span>}
        </div>
      </div>

      <label className="mt-3 block text-[11px] font-medium text-stone-400">missionTitle</label>
      <input
        value={missionTitle}
        onChange={(e) => setMissionTitle(e.target.value)}
        maxLength={60}
        placeholder="예: 첫 번째 흔적"
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <label className="mt-3 block text-[11px] font-medium text-stone-400">missionNarrative</label>
      <textarea
        value={missionNarrative}
        onChange={(e) => setMissionNarrative(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Step 진입 시 보여줄 짧은 탐험 서사"
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run({})}
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          저장{dirty ? " *" : ""}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ reviewStatus: "REVIEW_NEEDED" })}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50"
        >
          검수 필요
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ reviewStatus: "APPROVED" })}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
        >
          검수 완료
        </button>
        {isPublished ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ isPublished: false })}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 disabled:opacity-50"
          >
            비공개로 전환
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ isPublished: true })}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            공개
          </button>
        )}
        {message && (
          <span className={`text-xs ${message.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

// Book Editorial 편집기. MissionEditor와 동일한 저장/상태 정책.
function BookEditorialEditor({ book }: { book: AdminCandidate["book"] }) {
  const [hook, setHook] = useState(book.editorial.hook ?? "");
  const [teaser, setTeaser] = useState(book.editorial.teaser ?? "");
  const [question, setQuestion] = useState(book.editorial.question ?? "");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusValue>(book.editorial.reviewStatus);
  const [isPublished, setIsPublished] = useState(book.editorial.isPublished);
  const [exists, setExists] = useState(book.editorial.exists);
  const [saved, setSaved] = useState({ hook: book.editorial.hook ?? "", teaser: book.editorial.teaser ?? "", question: book.editorial.question ?? "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  const dirty = hook !== saved.hook || teaser !== saved.teaser || question !== saved.question;

  async function run(extra: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    const { ok, data } = await patchJson(`/api/admin/book-editorials/${book.id}`, {
      hook,
      teaser,
      question,
      ...extra,
    });
    if (ok) {
      setReviewStatus(data.editorial.reviewStatus);
      setIsPublished(data.editorial.isPublished);
      setExists(true);
      setSaved({ hook, teaser, question });
      setMessage({ type: "success", text: "저장됐어요." });
    } else {
      setMessage({ type: "error", text: data.message ?? "저장하지 못했어요. 다시 시도해주세요." });
    }
    setPending(false);
  }

  return (
    <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-500">Book Editorial · {book.title}</p>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={reviewStatus} />
          <PublishBadge isPublished={isPublished} />
          {!exists && <span className="text-[11px] text-stone-400">(아직 DB에 콘텐츠 없음)</span>}
        </div>
      </div>

      <label className="mt-3 block text-[11px] font-medium text-stone-400">hook (이 책이 끌리는 이유, 한 줄)</label>
      <input
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        maxLength={160}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <label className="mt-3 block text-[11px] font-medium text-stone-400">teaser (짧은 소개)</label>
      <textarea
        value={teaser}
        onChange={(e) => setTeaser(e.target.value)}
        maxLength={500}
        rows={2}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <label className="mt-3 block text-[11px] font-medium text-stone-400">question (읽기 전 질문)</label>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={240}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run({})}
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          저장{dirty ? " *" : ""}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ reviewStatus: "REVIEW_NEEDED" })}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50"
        >
          검수 필요
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ reviewStatus: "APPROVED" })}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
        >
          검수 완료
        </button>
        {isPublished ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ isPublished: false })}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 disabled:opacity-50"
          >
            비공개로 전환
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ isPublished: true })}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            공개
          </button>
        )}
        {message && (
          <span className={`text-xs ${message.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: AdminCandidate }) {
  const [open, setOpen] = useState(false);
  const { book } = candidate;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {candidate.isPrimary && (
              <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-medium text-white">대표</span>
            )}
            <p className="break-keep text-sm font-semibold text-stone-900">{book.title}</p>
          </div>
          <p className="mt-0.5 break-keep text-xs text-stone-500">{book.author ?? "-"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-400">
            <span className="inline-flex items-center gap-1 font-mono">
              {book.isbn13}
              <CopyIsbnButton isbn13={book.isbn13} />
            </span>
            <span>{book.className ?? "-"}</span>
            <span>{book.callNumber ?? "-"}</span>
            <span>{book.shelfLocation ?? "-"}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={book.editorial.reviewStatus} />
          <PublishBadge isPublished={book.editorial.isPublished} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="whitespace-nowrap rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            {open ? "닫기" : "콘텐츠 편집"}
          </button>
        </div>
      </div>
      {open && <BookEditorialEditor book={book} />}
    </div>
  );
}

function StepPanel({ step }: { step: AdminStep }) {
  return (
    <div className="flex flex-col gap-3">
      <MissionEditor step={step} />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-stone-500">후보 도서 {step.candidates.length}권</p>
        {step.candidates.map((c) => (
          <CandidateRow key={c.book.id} candidate={c} />
        ))}
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: AdminQuest }) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-stone-900">{quest.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            quest.published ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
          }`}
        >
          {quest.published ? "이용자 공개 중" : "미게시"}
        </span>
      </div>
      <p className="mt-1 break-keep text-sm text-stone-500">{quest.description}</p>

      <div className="mt-4 flex flex-col gap-2">
        {quest.steps.map((step) => {
          const isOpen = expandedStepId === step.id;
          return (
            <div key={step.id} className="rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setExpandedStepId(isOpen ? null : step.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-stone-800">
                  Step {step.order} · {step.title}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={step.mission.reviewStatus} />
                  <span aria-hidden="true" className="text-stone-400">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-stone-200 p-4">
                  <StepPanel step={step} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResetButton({ libraryCode, libraryName }: { libraryCode: string; libraryName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SaveMessage>(null);

  async function handleReset() {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/demo-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ type: "success", text: "초기화됐어요. 화면을 새로고침합니다." });
        setTimeout(() => window.location.reload(), 800);
      } else {
        setResult({ type: "error", text: data.message ?? "초기화하지 못했어요." });
      }
    } catch {
      setResult({ type: "error", text: "초기화하지 못했어요." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
      >
        데모 데이터 초기화
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-bold text-stone-900">{libraryName}의 운영 콘텐츠를 초기 상태로 되돌릴까요?</h3>
            <p className="mt-2 text-sm text-stone-600">
              Mission 문구와 도서 콘텐츠 수정 내용이 초기 데모 데이터로 복원됩니다. 장서·Quest·후보
              도서는 변경되지 않습니다.
            </p>
            {result && (
              <p className={`mt-2 text-sm ${result.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                {result.text}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={pending}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "초기화 중..." : "초기화"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminConsole({
  library,
  libraryOptions,
  quests,
  summary,
}: {
  library: { code: string; name: string };
  libraryOptions: { code: string; name: string }[];
  quests: AdminQuest[];
  summary: {
    questCount: number;
    stepCount: number;
    candidateCount: number;
    bookCount: number;
    missionApprovedCount: number;
    editorialApprovedCount: number;
    publishedContentCount: number;
  };
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            DEMO ADMIN
          </span>
          <h1 className="mt-2 text-xl font-bold text-stone-900">Lib Quest 운영 콘솔</h1>
          <p className="mt-1 text-sm text-stone-500">
            실제 장서에서 구성한 탐험 콘텐츠를 검수하고 이용자에게 공개합니다.
          </p>
        </div>
        <ResetButton libraryCode={library.code} libraryName={library.name} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-400">
        {["Data4Library 후보", "콘텐츠 작성", "운영자 검수", "이용자 공개"].map((step, i, arr) => (
          <span key={step} className="flex items-center gap-1.5">
            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-slate-600">{step}</span>
            {i < arr.length - 1 && <span aria-hidden="true">→</span>}
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {libraryOptions.map((opt) => (
          <Link
            key={opt.code}
            href={`/admin/review?library=${opt.code}`}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              opt.code === library.code
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {opt.name}
          </Link>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">선택한 도서관</p>
        <p className="mt-1 font-semibold">{library.name}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "퀘스트", value: `${summary.questCount}개` },
            { label: "단계", value: `${summary.stepCount}개` },
            { label: "후보 도서", value: `${summary.candidateCount}개` },
            { label: "실제 활용 도서", value: `${summary.bookCount}권` },
            { label: "Mission 검수 완료", value: `${summary.missionApprovedCount} / ${summary.stepCount}` },
            { label: "Editorial 검수 완료", value: `${summary.editorialApprovedCount} / ${summary.bookCount}` },
            { label: "공개된 콘텐츠 (Mission+Editorial)", value: `${summary.publishedContentCount}개` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        {quests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>

      <Link href="/data-source" className="mt-6 text-xs text-slate-400 underline underline-offset-2">
        데이터 출처 보기
      </Link>
    </main>
  );
}
