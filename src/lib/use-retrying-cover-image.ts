"use client";

// 표지 이미지(외부 CDN: image.aladin.co.kr / shopping-phinf.pstatic.net) 로딩 상태를
// 공통으로 관리하는 hook. DiscoveryCard3D의 3D 표지 레이어와 QuestRunner의 BookThumb가
// 각자 <img>는 따로 렌더링하지만(구조가 서로 달라 강제로 하나의 컴포넌트로 합치지 않는다),
// loading/error/retry 로직만 이 hook으로 공유한다.
//
// 간헐적 표지 로딩 실패는 서버에서 반복 요청했을 때는 재현되지 않았다(139개 URL, 각 2회
// 요청 모두 200) — 즉 CDN 자체가 불안정하다는 증거는 없다. 다만 모바일 브라우저(특히
// 인앱 브라우저)에서는 개별 요청이 일시적으로 실패하거나 취소될 수 있으므로, 무한 재시도가
// 아닌 제한적 1회 retry로 그 가능성만 흡수한다.
import { useEffect, useRef, useState } from "react";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

export type CoverImageStatus = "idle" | "loading" | "loaded" | "retrying" | "failed";

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function useRetryingCoverImage(url: string | null | undefined) {
  const [status, setStatus] = useState<CoverImageStatus>(url ? "loading" : "idle");
  const [retryKey, setRetryKey] = useState(0);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    retryCountRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRetryKey(0);
    setStatus(url ? "loading" : "idle");
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [url]);

  function handleLoad() {
    setStatus("loaded");
  }

  function handleError() {
    if (!url) return;
    if (retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current += 1;
      const attempt = retryCountRef.current;
      setStatus("retrying");
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[cover] 로딩 실패, ${RETRY_DELAY_MS}ms 후 재시도 (${attempt}/${MAX_RETRIES})`, {
          url,
          host: safeHost(url),
        });
      }
      timeoutRef.current = setTimeout(() => {
        // src를 그대로 재사용하면 브라우저가 재요청하지 않을 수 있어, <img key={retryKey}>로
        // 엘리먼트를 리마운트해 실제 네트워크 재요청을 강제한다. 랜덤 cache-bust 쿼리는
        // 붙이지 않는다 — 외부 CDN에 불필요한 새 URL을 반복 요청하지 않기 위함.
        setRetryKey((k) => k + 1);
        setStatus("loading");
      }, RETRY_DELAY_MS);
    } else {
      setStatus("failed");
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[cover] 재시도(${MAX_RETRIES}회) 후에도 로딩 실패`, { url, host: safeHost(url) });
      }
    }
  }

  return { status, retryKey, handleLoad, handleError };
}
