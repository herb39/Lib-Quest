import { notFound } from "next/navigation";
import { getQuestById } from "@/lib/mock-data";
import { QuestRunner } from "@/components/QuestRunner";

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quest = getQuestById(id);

  if (!quest || quest.steps.length === 0) {
    notFound();
  }

  return <QuestRunner quest={quest} />;
}
