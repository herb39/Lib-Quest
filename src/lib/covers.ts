// ISBN → 표지 이미지 URL 조회.
//
// data/libraries/*/collected-books.json 은 DB Book 테이블에 표지 필드가 없어(스키마 변경 없이
// 이번 작업 범위를 최소화하기 위함), Data4Library itemSrch 원본 응답(data/snapshots/)에서
// 실제로 내려온 bookImageURL 값을 ISBN 기준으로 그대로 추려 이 JSON에 저장해 둔다.
// 임의로 생성하거나 ISBN 패턴으로 유추한 URL은 전혀 없다 — 매칭되지 않으면 조회 결과가 없다(fallback 처리).
import coverUrls from "@/lib/cover-urls.json";

const COVER_URLS: Record<string, string> = coverUrls;

export function getCoverUrl(isbn13: string): string | null {
  return COVER_URLS[isbn13] ?? null;
}
