import { notFound } from "next/navigation";
import { getQuestDetail } from "@/lib/data";
import { QuestRunner } from "@/components/QuestRunner";
import type { QuestSummary } from "@/lib/types";

// DB 상태를 항상 최신으로 보여줘야 하므로 빌드 시점 정적 생성 대신 요청마다 조회한다.
export const dynamic = "force-dynamic";

// 사용자 플레이 화면에서는 아직 발견하지 않은 후보 도서의 제목/저자/ISBN을 감춰야 한다
// ("미지의 후보" 연출, 정답을 미리 노출하지 않기 위함). 서가 위치/청구기호는 실제 책을
// 찾아가는 데 필요한 정보이므로 그대로 전달한다. 운영자 화면(/admin/review)은 이 함수를
// 거치지 않는 별도 조회(getAdminReviewData)를 쓰므로 후보 전체 공개가 계속 유지된다.
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
          callNumber: c.book.callNumber,
          shelfLocation: c.book.shelfLocation,
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
