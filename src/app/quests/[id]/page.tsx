import { notFound } from "next/navigation";
import { getQuestDetail } from "@/lib/data";
import { QuestRunner } from "@/components/QuestRunner";
import type { QuestSummary } from "@/lib/types";

// DB 상태를 항상 최신으로 보여줘야 하므로 빌드 시점 정적 생성 대신 요청마다 조회한다.
export const dynamic = "force-dynamic";

// 사용자 플레이 화면에서는 아직 발견하지 않은 후보 도서의 제목/저자/ISBN을 감춰야 한다
// ("미지의 후보" 연출, 정답을 미리 노출하지 않기 위함).
//
// 청구기호(callNumber)도 여기서 함께 감춘다 — 같은 Step의 후보들은 shelfLocation/className이
// 전부 동일하지만 callNumber만 후보마다 달라서(예: 은942ㅅ vs 천423ㅇ), 인증 전에 그대로 보여주면
// 사실상 특정 후보 한 권의 정체를 짚어주는 것과 다르지 않다. 대신 서가 위치(shelfLocation)와
// 분류명(className)은 Step 전체에 공통되는 "탐색 범위" 정보라 인증 전에도 안전하게 보여준다
// (실제로 원신흥 큐레이션에서 같은 Step의 후보 4권은 항상 같은 className/shelfLocation을 갖는다).
// 발견 성공 후의 정확한 청구기호는 verify API 응답(bookCallNumber)에서 별도로 받는다.
//
// 운영자 화면(/admin/review)은 이 함수를 거치지 않는 별도 조회(getAdminReviewData)를 쓰므로
// 후보 전체(청구기호 포함)가 계속 그대로 노출된다.
function redactCandidatesForPlay(quest: QuestSummary): QuestSummary {
  return {
    ...quest,
    steps: quest.steps.map((step) => ({
      ...step,
      candidates: step.candidates.map((c) => ({
        isPrimary: c.isPrimary,
        book: {
          id: c.book.id,
          isbn13: "",
          title: "",
          author: null,
          callNumber: null,
          shelfLocation: c.book.shelfLocation,
          className: c.book.className,
        },
      })),
    })),
  };
}

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quest = await getQuestDetail(id);

  if (!quest || quest.steps.length === 0) {
    notFound();
  }

  return <QuestRunner quest={redactCandidatesForPlay(quest)} />;
}
