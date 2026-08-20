# Lib Quest Service Design

**대상: 개발자 / 심사자 / 향후 유지보수자** — Lib Quest의 제품 방향과 B2B2C 구조를 이해하기 위한 문서. 화면 사용법은 [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)/[DEMO_GUIDE.md](DEMO_GUIDE.md), 기술 구조는 [DEVELOPMENT.md](DEVELOPMENT.md)를 참고한다.

## 1. 서비스 목표

책을 찾게 하는 것이 최종 목적이 아니다. Lib Quest의 목표는:

**발견 → 관심 → 선택 → 독서**로 이어지는 전환을 만드는 것이다.

ISBN 인증은 이 여정의 중간 단계(책을 실제로 찾았다는 증거)일 뿐, "인증 자체"가 목적이 되지 않도록 발견 이후의 경험(콘텐츠, 관심 표시, 오늘의 한 권 선택)을 함께 설계한다.

## 2. 핵심 사용자 경험

```
Quest 선택 → Mission Narrative(탐험 동기) → 실제 서가 탐험 → Discovery Moment(발견의 감정적 보상)
  → Book Exploration(독서 호기심) → Interest(읽어보고 싶어요) → Final Selection(오늘의 한 권 선택)
```

각 단계는 이전 P0 작업에서 순차적으로 쌓였다.

| 단계 | 도입 시점 | 핵심 산출물 |
| --- | --- | --- |
| Quest 탐험 경험 | P0-1 | intro 화면, Step 진행 경로, 후보 redaction |
| Discovery(3D 발견) | P0-2 | `DiscoveryCard3D`, 표지 공개, XP, 발견 도감 |
| Interest/Final Selection | P0-2.5 | teaser/hook/question, 읽어보고 싶어요, 오늘의 한 권 |
| Mission Narrative | P0-2.6 | Step을 지시문이 아닌 탐험으로 표현하는 missionTitle/missionNarrative, "탐험 단서" 카드 |
| 3D Book Object · Discovery/BookInfo 분리 | P0-3(이 문서 기준) | 실제 두께가 있는 책 오브젝트(`DiscoveryCard3D`), 발견 순간과 책 정보 화면의 완전 분리 |

## 3. 게임화 원칙

게임화는 독서를 대신하는 목적이 아니라 **사용자가 낯선 장서에 접근하게 만드는 동기 장치**다.

- **Mission Narrative** — 발견 **이전**의 기대감. Step 안내를 "일본소설을 찾아보세요 / 찾아갈 곳: 종합자료실" 같은 업무 지시문이 아니라, 앞선 Step에서 자연스럽게 이어지는 짧은 탐험 서사(missionTitle/missionNarrative)로 감싼다. 단, 실제로 무엇을 찾아야 하는지는 절대 숨기지 않는다 — narrative 아래 "이번 미션"에 실제 Step 조건을 그대로 명시한다([mission-content.ts](../src/lib/mission-content.ts)).
- **탐험 단서** — 위치 정보를 목적이 아니라 단서로 취급한다. 서가 위치/분류(className)는 한 Step의 후보 전체에 공통되므로 안전하게 보여주고, 후보마다 다른 정확한 청구기호는 정답을 사실상 특정할 수 있어 인증 전에는 보여주지 않는다([DEVELOPMENT.md](DEVELOPMENT.md)의 "인증 전 데이터 redaction" 참고).
- **3D Book Discovery** — 발견 **순간**의 보상. ISBN 인증 성공 직후에는 큰 책 오브젝트와 제목/저자/XP만 보여주고, hook/teaser/question 같은 정보는 절대 함께 띄우지 않는다 — 발견의 임팩트가 정보에 묻히지 않도록 화면 자체를 분리했다.
- **Book Editorial(hook/teaser/question)** — 발견 **이후**의 독서 호기심. 사용자가 직접 `책 살펴보기`를 눌러야만 보여준다.
- **XP** — 탐험 동기. 신규 발견 1권당 +10, 재발견은 0. `getXp = 발견 도감 unique 권수 × 10`으로 항상 계산해 별도 mutable 값을 저장하지 않는다([discovery-storage.ts](../src/lib/discovery-storage.ts)).
- **발견 도감** — 발견 누적. Quest 진행 상태(QuestSession)와 완전히 분리된 별도 localStorage(`libquest_discoveries`).
- **Interest(읽어보고 싶어요)** — 독서 의향 신호. **XP를 절대 부여하지 않는다** — 관심도 없는 책을 XP 때문에 누르게 만드는 유인을 피하기 위함이다.
- **Final Selection(오늘의 한 권)** — 발견한 책들 중 실제로 읽을 한 권을 결정하는, 독서 관심의 최종 결과.

## 4. B2B2C

```
도서관/사서 → Lib Quest → 이용자 → 행동 데이터 → 운영 개선
```

- **B(도서관/사서)**: 실제 장서 데이터 → 후보 도서 구성 → 콘텐츠 검수 → Quest 운영 → 이용자 반응 분석
- **C(도서관 이용자)**: Quest 선택 → 실제 서가 이동 → 책 발견 → 콘텐츠 확인 → 읽고 싶어요 → 오늘의 한 권 선택
- **다시 B**: 어떤 책이 발견되었는지 / 관심을 얻었는지 / 최종 선택되었는지를 분석해 다음 Quest 구성에 활용 — **이 analytics 집계·대시보드는 아직 구현되지 않은 roadmap이다** (9절 참고).

## 5. 운영자 workflow

```
Data4Library 후보 → 콘텐츠 작성 → 운영자 검수 → 이용자 공개
```

`/admin/review`의 각 후보 도서 행에 이 4단계 워크플로 표시가 상단에 노출된다.

**현재 구현된 것:**
- Data4Library 후보 확인 (표, ISBN 복사)
- 콘텐츠(teaser/hook/question) **읽기 전용** 확인 — "콘텐츠 보기" expandable 패널, "검수된 콘텐츠"/"콘텐츠 없음" 상태만 표시

**아직 구현되지 않은 것 (roadmap):**
- 운영자가 화면에서 직접 hook/teaser/question을 수정하는 기능
- 후보 도서 제외/교체
- 검수 상태(초안/검수 완료)의 실제 저장·변경

두 가지 모두 인증/권한 없이 접근 가능한 현재 `/admin/review` 구조에서 쓰기(write) 기능을 그대로 열면 누구나 production 데이터를 바꿀 수 있게 되므로, 이번 단계에서는 의도적으로 구현하지 않았다([OPERATOR_GUIDE.md](OPERATOR_GUIDE.md) 참고).

## 6. AI 사용 원칙

AI는 다음의 **초안 생성 보조**로만 사용한다.

- teaser / hook / question
- (향후) Quest copy 초안

AI가 결정하지 않는 것:

- 책의 존재 여부, ISBN, 정답 판정
- 서가 위치, 청구기호
- 후보 적합성의 최종 결정 (사람이 검수)

**실시간 user-facing LLM 호출은 현재 사용하지 않는다.** ISBN 인증 성공 시점에 즉석으로 줄거리를 생성하는 구조는 다음 이유로 도입하지 않았다.

- latency: 발표/시연 중 응답 지연 위험
- cost: 매 요청 API 과금
- API 장애: 외부 서비스 장애가 곧 서비스 장애가 됨
- 문구 비일관성: 같은 책도 호출마다 다른 문구가 나올 수 있음
- hallucination: 실제 데이터에 없는 줄거리/인물/추천사를 만들어낼 위험
- 발표 안정성: 무엇보다 데모 중 예측 가능해야 함

대신 teaser/hook/question은 **사전에 작성되고 저장소에 커밋된 정적 콘텐츠**다(`data/libraries/<libCode>/book-editorial.json`, [DEVELOPMENT.md](DEVELOPMENT.md) 참고). 실제 서지 데이터(제목/부제/저자/KDC 분류)에 근거해서만 작성했고, Data4Library API가 줄거리/키워드 필드를 제공하지 않으므로 소설류는 장르·작가 소개 수준으로 제한했다(구체적 줄거리를 상상해서 쓰지 않음).

## 7. KPI

```
Quest 노출 → 시작 → 책 발견 → 읽고 싶어요 → 오늘의 한 권 선택 → (향후) 실제 열람/대출 연계
```

- **Discovery → Interest Conversion**: 발견한 책 중 `읽어보고 싶어요`를 선택한 비율
- **Interest → Final Selection**: 관심 표시한 책 중 `오늘의 한 권`으로 최종 선택된 비율
- **Selection → Loan** (향후): 도서관 대출/OPAC 시스템과 연동되면 확장 가능. **현재 시스템은 실제 대출 여부를 전혀 알 수 없으므로, 이 지표는 아직 측정되지 않는다.**

## 8. 현재 MVP 범위 (실제 구현된 것만)

- 4개 도서관, 144권 실장서, Quest 12개 / Step 36개 / Candidate 144개
- ISBN 카메라 스캔(ZXing) / 직접 입력, 서버 판정
- 후보 정답 정보(title/author/ISBN/표지/콘텐츠) client redaction — 인증 전 노출 없음
- Quest intro, Step 진행 경로, 순수 CSS 3D 책 오브젝트(숨김 ↔ 발견), 실제 표지 공개
- Discovery(발견 순간)와 Book Info(발견 후 정보) 화면 분리 — 발견 직후에는 큰 책과 제목/저자/XP만, `책 살펴보기`를 눌러야 hook/teaser/question이 노출
- 신규 발견 +10 XP, 중복 발견 XP 방지, 탐험 칭호
- 발견 도감(`/discoveries`), 도서관별 발견 진행도
- 책마다 teaser/hook/question (원신흥도서관 36권 전체 작성, 그 외 도서관은 아직 미작성)
- Mission Narrative(missionTitle/missionNarrative) — 원신흥도서관 3개 Quest × 3 Step 전체 작성, "탐험 단서" 카드(서가 위치/분류/후보 수), 다른 도서관·나머지 Quest는 generic fallback
- `읽어보고 싶어요`(관심 표시), `/discoveries` 관심 필터
- Quest 완료 후 **오늘의 한 권** 선택, 결과 화면 반영
- `/admin/review` 콘텐츠 검수 표시(읽기 전용), 운영 workflow 안내
- `/data-source` 데이터 출처 안내
- Header `처음부터` — 이 브라우저의 Lib Quest 사용자 진행 상태(Quest 세션 전체 + 발견 도감 + 관심 + 오늘의 한 권) 전체 초기화

## 9. Roadmap (아직 구현되지 않음)

- 운영자가 `/admin/review`에서 hook/teaser/question을 직접 편집
- 운영자 검수 상태(초안/검수완료)의 실제 persistence
- 후보 도서 제외/교체(운영자 write 기능) — 인증/권한 체계 선행 필요
- 익명 analytics 이벤트 수집·집계 대시보드 (이벤트 후보는 아래 참고)
- 실제 도서관 대출/OPAC 시스템 연계
- 갈마/가수원/노은도서관 108권 teaser/hook/question 작성
- 나머지 도서관·Quest의 Mission Narrative(missionTitle/missionNarrative) 작성

### Analytics 이벤트 후보 (설계만, 서버 수집 미구현)

`quest_started`, `book_discovered`, `book_interested`, `quest_completed`, `final_book_selected`, `scan_failed`, `candidate_mismatch`

이 이벤트들은 현재 서버 analytics DB에 실제로 적재되지 않는다. 다만 클라이언트 액션 구조(`QuestRunner`의 `handleVerify`/`handleToggleInterest`/`handleSelectFinalBook` 등)가 각 액션 시점에 이미 명확히 분리되어 있어, 추후 이 지점에 이벤트 전송 호출을 추가하기 쉬운 상태를 유지하는 것을 설계 원칙으로 삼는다.
