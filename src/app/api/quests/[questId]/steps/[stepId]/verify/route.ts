import { NextResponse } from "next/server";
import { normalizeIsbn, getDemoQuestById } from "@/lib/mock-data";
import { getCoverUrl } from "@/lib/covers";
import { getEditorial } from "@/lib/editorial";

const hasDatabase = Boolean(process.env.DATABASE_URL);

type VerifyResult =
  | {
      success: true;
      bookId: string;
      bookTitle: string;
      bookAuthor: string | null;
      bookClassName: string | null;
      bookCallNumber: string | null;
      bookImageUrl: string | null;
      teaser: string | null;
      hook: string | null;
      question: string | null;
    }
  | { success: false; message: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ questId: string; stepId: string }> }
) {
  const { questId, stepId } = await params;

  let isbn13: unknown;
  try {
    const body = await request.json();
    isbn13 = body?.isbn13;
  } catch {
    return NextResponse.json({ success: false, message: "잘못된 요청입니다." } satisfies VerifyResult, { status: 400 });
  }

  if (typeof isbn13 !== "string" || !isbn13.trim()) {
    return NextResponse.json(
      { success: false, message: "ISBN을 입력하거나 스캔해주세요." } satisfies VerifyResult,
      { status: 400 }
    );
  }

  const normalized = normalizeIsbn(isbn13);
  const result = hasDatabase
    ? await verifyAgainstDatabase(questId, stepId, normalized)
    : verifyAgainstDemo(questId, stepId, normalized);

  return NextResponse.json(result, { status: result.success ? 200 : 200 });
}

async function verifyAgainstDatabase(
  questId: string,
  stepId: string,
  normalizedIsbn: string
): Promise<VerifyResult> {
  const { prisma } = await import("@/lib/prisma");

  const step = await prisma.questStep.findFirst({
    where: { id: stepId, questId },
    include: { candidates: { include: { book: { include: { library: true } } } } },
  });

  if (!step) {
    return { success: false, message: "존재하지 않는 단계입니다." };
  }

  const matched = step.candidates.find((c) => c.book.isbn13 === normalizedIsbn);
  if (!matched) {
    return { success: false, message: "이 단계의 후보 도서가 아니에요. 다시 확인해주세요." };
  }

  const editorial = getEditorial(matched.book.library.code, matched.book.isbn13);

  return {
    success: true,
    bookId: matched.book.id,
    bookTitle: matched.book.title,
    bookAuthor: matched.book.author,
    bookClassName: matched.book.className,
    bookCallNumber: matched.book.callNumber,
    bookImageUrl: getCoverUrl(matched.book.isbn13),
    teaser: editorial?.teaser ?? null,
    hook: editorial?.hook ?? null,
    question: editorial?.question ?? null,
  };
}

function verifyAgainstDemo(questId: string, stepId: string, normalizedIsbn: string): VerifyResult {
  const quest = getDemoQuestById(questId);
  const step = quest?.steps.find((s) => s.id === stepId);

  if (!step) {
    return { success: false, message: "존재하지 않는 단계입니다." };
  }

  const matched = step.candidates.find((c) => c.book.isbn13 === normalizedIsbn);
  if (!matched) {
    return { success: false, message: "이 단계의 후보 도서가 아니에요. 다시 확인해주세요." };
  }

  return {
    success: true,
    bookId: matched.book.id,
    bookTitle: matched.book.title,
    bookAuthor: matched.book.author,
    bookClassName: null,
    bookCallNumber: matched.book.callNumber,
    bookImageUrl: getCoverUrl(matched.book.isbn13),
    teaser: null,
    hook: null,
    question: null,
  };
}
