import { NextResponse } from "next/server";
import { CONTENT_LIMITS, canPublish, isReviewStatus, sanitizeOptionalText, type ReviewStatusValue } from "@/lib/admin-content";

// 운영자가 /admin/review에서 Step의 missionTitle/missionNarrative를 저장·검수·공개하는 write API.
// book-editorials route와 동일한 정책(필드 화이트리스트, APPROVED에서만 공개, 본문 수정 시
// 자동 재검수)을 따른다.
export async function PATCH(request: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const { stepId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  const step = await prisma.questStep.findUnique({ where: { id: stepId } });
  if (!step) {
    return NextResponse.json({ success: false, message: "존재하지 않는 단계입니다." }, { status: 404 });
  }

  const missionTitle = sanitizeOptionalText(body, "missionTitle", CONTENT_LIMITS.missionTitle);
  const missionNarrative = sanitizeOptionalText(body, "missionNarrative", CONTENT_LIMITS.missionNarrative);
  const firstError = missionTitle.error ?? missionNarrative.error;
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

  const existing = await prisma.missionContent.findUnique({ where: { questStepId: stepId } });

  let reviewStatus: ReviewStatusValue = hasStatusField
    ? (body.reviewStatus as ReviewStatusValue)
    : (existing?.reviewStatus as ReviewStatusValue | undefined) ?? "DRAFT";
  let isPublished = hasPublishField ? (body.isPublished as boolean) : (existing?.isPublished ?? false);

  const hasTextFields = missionTitle.value !== undefined || missionNarrative.value !== undefined;
  if (hasTextFields && !hasStatusField && !hasPublishField && existing?.reviewStatus === "APPROVED") {
    reviewStatus = "REVIEW_NEEDED";
    isPublished = false;
  }

  if (isPublished && !canPublish(reviewStatus)) {
    return NextResponse.json({ success: false, message: "검수 완료 후 공개할 수 있어요." }, { status: 400 });
  }

  try {
    const saved = await prisma.missionContent.upsert({
      where: { questStepId: stepId },
      create: {
        questStepId: stepId,
        missionTitle: missionTitle.value ?? null,
        missionNarrative: missionNarrative.value ?? null,
        reviewStatus,
        isPublished,
      },
      update: {
        ...(missionTitle.value !== undefined ? { missionTitle: missionTitle.value } : {}),
        ...(missionNarrative.value !== undefined ? { missionNarrative: missionNarrative.value } : {}),
        reviewStatus,
        isPublished,
      },
    });

    return NextResponse.json({
      success: true,
      mission: {
        id: saved.id,
        missionTitle: saved.missionTitle,
        missionNarrative: saved.missionNarrative,
        reviewStatus: saved.reviewStatus,
        isPublished: saved.isPublished,
        updatedAt: saved.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[admin/mission-contents] save failed", e);
    return NextResponse.json({ success: false, message: "저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
