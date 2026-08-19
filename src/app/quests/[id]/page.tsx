import { notFound } from "next/navigation";
import { getQuestDetail } from "@/lib/data";
import { QuestRunner } from "@/components/QuestRunner";

// DB 상태를 항상 최신으로 보여줘야 하므로 빌드 시점 정적 생성 대신 요청마다 조회한다.
export const dynamic = "force-dynamic";

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

  return <QuestRunner quest={quest} />;
}
