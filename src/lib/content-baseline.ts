// data/libraries/<libCode>/book-editorial.json, quest-missions.json(JSON baseline) 원본 판독.
//
// 이 파일은 런타임 사용자 화면에서는 쓰이지 않는다 — 사용자 화면(verify API, Quest 상세)은
// BookEditorial/MissionContent DB 테이블을 source of truth로 조회한다(P1). 이 baseline reader는
// (1) scripts/import-editorial-content.ts의 최초 DB 시드, (2) /api/admin/demo-reset의 복원 기준,
// 이 두 곳에서만 쓰인다.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const LIBRARIES_DIR = path.join(process.cwd(), "data", "libraries");

export type EditorialBaselineEntry = { hook: string; teaser: string; question: string };
export type MissionBaselineEntry = { missionTitle: string; missionNarrative: string };

type EditorialFile = { books: Record<string, EditorialBaselineEntry> };
type MissionFile = { quests: Record<string, { steps: Record<string, MissionBaselineEntry> }> };

/** ISBN → baseline editorial. 해당 도서관에 baseline 파일이 없으면 null. */
export function loadEditorialBaseline(libCode: string): Record<string, EditorialBaselineEntry> | null {
  const filePath = path.join(LIBRARIES_DIR, libCode, "book-editorial.json");
  if (!existsSync(filePath)) return null;
  const file = JSON.parse(readFileSync(filePath, "utf-8")) as EditorialFile;
  return file.books;
}

/** Quest 제목 → { Step order → baseline mission content }. 해당 도서관에 baseline 파일이 없으면 null. */
export function loadMissionBaseline(
  libCode: string
): Record<string, Record<string, MissionBaselineEntry>> | null {
  const filePath = path.join(LIBRARIES_DIR, libCode, "quest-missions.json");
  if (!existsSync(filePath)) return null;
  const file = JSON.parse(readFileSync(filePath, "utf-8")) as MissionFile;
  const result: Record<string, Record<string, MissionBaselineEntry>> = {};
  for (const [questTitle, quest] of Object.entries(file.quests)) {
    result[questTitle] = quest.steps;
  }
  return result;
}
