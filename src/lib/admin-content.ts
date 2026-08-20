// /api/admin/* write route들이 공유하는 최소 validation/정책 헬퍼.
//
// 핵심 규칙(P1):
// - 클라이언트 payload를 절대 그대로 Prisma update에 넘기지 않는다 — 허용된 필드만 골라 쓴다.
// - "검수 완료"와 "공개"는 별개 축이라, 공개(isPublished=true)는 reviewStatus가 APPROVED일 때만
//   서버에서 허용한다.
// - 이미 APPROVED된 콘텐츠의 본문(hook/teaser/question, missionTitle/missionNarrative)만 수정하는
//   요청(상태/공개 필드를 함께 보내지 않은 요청)은 재검수가 필요하다고 보고 자동으로
//   REVIEW_NEEDED + 비공개로 되돌린다 — 데모에서 저장/검수/공개 3단계를 명확히 보여주기 위함.

export const CONTENT_LIMITS = {
  hook: 160,
  teaser: 500,
  question: 240,
  missionTitle: 60,
  missionNarrative: 300,
} as const;

export const REVIEW_STATUSES = ["DRAFT", "REVIEW_NEEDED", "APPROVED"] as const;
export type ReviewStatusValue = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(value: unknown): value is ReviewStatusValue {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

export type SanitizeResult = { value?: string | null; error?: string };

/** body[field]가 있을 때만 trim/길이 검증 후 반환한다. 없으면 빈 객체(= 변경 없음). */
export function sanitizeOptionalText(
  body: Record<string, unknown>,
  field: string,
  maxLen: number
): SanitizeResult {
  if (!(field in body)) return {};
  const raw = body[field];
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: `${field}은(는) 문자열이어야 합니다.` };
  const trimmed = raw.trim();
  if (trimmed.length > maxLen) return { error: `${field}은(는) ${maxLen}자를 넘을 수 없습니다.` };
  return { value: trimmed === "" ? null : trimmed };
}

/** isPublished=true 요청을 허용할지 판단한다. APPROVED 상태가 아니면 거부. */
export function canPublish(finalReviewStatus: ReviewStatusValue): boolean {
  return finalReviewStatus === "APPROVED";
}
