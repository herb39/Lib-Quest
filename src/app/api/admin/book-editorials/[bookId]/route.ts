import { NextResponse } from "next/server";
import { CONTENT_LIMITS, canPublish, isReviewStatus, sanitizeOptionalText, type ReviewStatusValue } from "@/lib/admin-content";

// 운영자가 /admin/review에서 책 콘텐츠(hook/teaser/question)를 저장·검수·공개하는 write API.
// 인증은 없다(공모전 데모 범위, docs/OPERATOR_GUIDE.md 참고) — 대신 수정 가능한 필드를
// 이 라우트에서만 화이트리스트로 제한하고, ISBN/제목/저자/청구기호 등 장서 원본은 절대 건드리지 않는다.
export async function PATCH(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ success: false, message: "존재하지 않는 책입니다." }, { status: 404 });
  }

  const hook = sanitizeOptionalText(body, "hook", CONTENT_LIMITS.hook);
  const teaser = sanitizeOptionalText(body, "teaser", CONTENT_LIMITS.teaser);
  const question = sanitizeOptionalText(body, "question", CONTENT_LIMITS.question);
  const firstError = hook.error ?? teaser.error ?? question.error;
  if (firstError) {
    return NextResponse.json({ success: false, message: firstError }, { status: 400 });
  }

  const hasStatusField = "reviewStatus" in body;
  const hasPublishField = "isPublished" in body;

  if (hasStatusField && !isReviewStatus(body.reviewStatus)) {
    return NextResponse.json({ success: false, message: "잘못된 검수 상태입니다." }, { status: 400 });
  }
  if (hasPublishField && typeof body.isPublished !== "boolean") {
    return NextResponse.json({ success: false, message: "잘못된 공개 상태입니다." }, { status: 400 });
  }

  const existing = await prisma.bookEditorial.findUnique({ where: { bookId } });

  let reviewStatus: ReviewStatusValue = hasStatusField
    ? (body.reviewStatus as ReviewStatusValue)
    : (existing?.reviewStatus as ReviewStatusValue | undefined) ?? "DRAFT";
  let isPublished = hasPublishField ? (body.isPublished as boolean) : (existing?.isPublished ?? false);

  const hasTextFields = hook.value !== undefined || teaser.value !== undefined || question.value !== undefined;
  // 이미 APPROVED된 콘텐츠의 본문만 고치는(상태/공개를 함께 요청하지 않은) 저장은 재검수가
  // 필요하다고 보고 자동으로 되돌린다 — 저장/검수/공개를 서로 다른 버튼으로 명확히 구분하기 위함.
  if (hasTextFields && !hasStatusField && !hasPublishField && existing?.reviewStatus === "APPROVED") {
    reviewStatus = "REVIEW_NEEDED";
    isPublished = false;
  }

  if (isPublished && !canPublish(reviewStatus)) {
    return NextResponse.json({ success: false, message: "검수 완료 후 공개할 수 있어요." }, { status: 400 });
  }

  try {
    const saved = await prisma.bookEditorial.upsert({
      where: { bookId },
      create: {
        bookId,
        hook: hook.value ?? null,
        teaser: teaser.value ?? null,
        question: question.value ?? null,
        reviewStatus,
        isPublished,
      },
      update: {
        ...(hook.value !== undefined ? { hook: hook.value } : {}),
        ...(teaser.value !== undefined ? { teaser: teaser.value } : {}),
        ...(question.value !== undefined ? { question: question.value } : {}),
        reviewStatus,
        isPublished,
      },
    });

    return NextResponse.json({
      success: true,
      editorial: {
        id: saved.id,
        hook: saved.hook,
        teaser: saved.teaser,
        question: saved.question,
        reviewStatus: saved.reviewStatus,
        isPublished: saved.isPublished,
        updatedAt: saved.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[admin/book-editorials] save failed", e);
    return NextResponse.json({ success: false, message: "저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
