// Step을 "지시문"이 아니라 "탐험"처럼 느끼게 하는 짧은 narrative(missionTitle/missionNarrative) 조회.
//
// 실제 행동 지시(무엇을 찾아야 하는지, 어디로 가야 하는지)는 이 파일이 다루지 않는다 — 그건 항상
// 실제 QuestStep.description/candidates 데이터를 그대로 보여준다. 이 콘텐츠는 그 앞에 붙는
// 분위기/서사일 뿐이며, book-editorial.json과 달리 정답 정보가 전혀 아니므로 인증 전에 그대로
// 노출해도 안전하다(P0-1 redaction 대상 아님).
//
// quest/step identity는 DB를 재시드하면 바뀌는 cuid 대신 (도서관 코드, 퀘스트 제목, step order)
// 조합으로 연결한다 — DEMO_GUIDE가 퀘스트를 항상 제목으로 안내하는 것과 같은 이유다.
import missions130026 from "../../data/libraries/130026/quest-missions.json";

export type MissionContent = {
  missionTitle: string;
  missionNarrative: string;
};

type MissionFile = {
  quests: Record<string, { steps: Record<string, MissionContent> }>;
};

const BY_LIBRARY: Record<string, MissionFile> = {
  "130026": missions130026 as MissionFile,
};

export function getMissionContent(
  libraryCode: string,
  questTitle: string,
  stepOrder: number
): MissionContent | null {
  return BY_LIBRARY[libraryCode]?.quests[questTitle]?.steps[String(stepOrder)] ?? null;
}
