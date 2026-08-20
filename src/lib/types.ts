// mock 데이터와 DB 조회 결과가 공통으로 따르는 화면용 타입.
// QuestRunner 등 클라이언트 컴포넌트는 데이터 출처(mock/DB)를 몰라도 되도록 이 타입만 의존한다.

export type BookSummary = {
  id: string;
  isbn13: string;
  title: string;
  author: string | null;
  callNumber: string | null;
  shelfLocation: string | null;
  className: string | null;
};

export type CandidateSummary = {
  book: BookSummary;
  isPrimary: boolean;
};

export type MissionContentSummary = {
  missionTitle: string | null;
  missionNarrative: string | null;
};

export type StepSummary = {
  id: string;
  order: number;
  title: string;
  description: string;
  hint: string | null;
  candidates: CandidateSummary[];
  /** 운영자가 검수·공개한 Mission Content. 없거나 미공개면 null(QuestRunner가 generic fallback을 쓴다). */
  mission: MissionContentSummary | null;
};

export type QuestSummary = {
  id: string;
  title: string;
  description: string;
  theme: string | null;
  estimatedMinutes: number | null;
  difficulty: string | null;
  libraryName: string;
  libraryCode: string;
  steps: StepSummary[];
};

export type QuestListItem = Pick<
  QuestSummary,
  "id" | "title" | "description" | "theme" | "estimatedMinutes" | "difficulty"
> & { stepCount: number };
