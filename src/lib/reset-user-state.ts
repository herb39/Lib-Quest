// "처음부터" 버튼 전용 — 이 브라우저에 쌓인 일반 사용자 진행 상태 전체를 새 사용자 상태로
// 되돌린다. 실제 발표 리허설, iPhone 네이버 인앱 브라우저처럼 개발자도구 접근이 어려운 환경에서
// 언제든 새 사용자로 다시 테스트할 수 있게 하기 위함이다.
//
// localStorage.clear()는 절대 쓰지 않는다 — 같은 origin에 Lib Quest가 모르는 다른 값이 있을 수
// 있으므로, 실제 코드에서 확인된 Lib Quest 소유 key만 선택적으로 지운다.
const QUEST_SESSION_PREFIX = "libquest_session_";
const OTHER_KEYS = ["libquest_discoveries", "libquest_interests", "libquest_final_selections"];

/** 브라우저에 쌓인 Lib Quest 사용자 진행 상태(Quest 세션 전체 + 발견 도감 + 관심 + 오늘의 한 권)를 지운다. */
export function resetLibQuestUserState() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && (key.startsWith(QUEST_SESSION_PREFIX) || OTHER_KEYS.includes(key))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
