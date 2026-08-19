"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// native BarcodeDetector는 Android/iOS 주요 브라우저(네이버 인앱, Safari 등)에서
// 지원 여부가 들쭉날쭉해 카메라 스캔 전체를 막아버리는 문제가 있었다.
// ZXing은 getUserMedia + <video>만 있으면 동작하므로 이 문제에 의존하지 않는다.
type ScanState = "idle" | "starting" | "scanning" | "permission-denied" | "no-camera" | "init-error";

function buildHints() {
  const hints = new Map<DecodeHintType, unknown>();
  // ISBN 바코드는 EAN-13 하나로 충분하므로 포맷을 제한해 인식 속도를 높인다.
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export function BarcodeScanner({ onScanned }: { onScanned: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const startingRef = useRef(false);
  const [state, setState] = useState<ScanState>("idle");

  function stopScanning() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setState("idle");
  }

  useEffect(() => {
    // 언마운트(단계 이동 등) 시 카메라 스트림이 남아있지 않도록 반드시 정리한다.
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  async function startScanning() {
    if (startingRef.current) return; // 중복 클릭으로 스캐너가 여러 개 뜨는 것을 방지
    startingRef.current = true;
    setState("starting");

    const reader = new BrowserMultiFormatReader(buildHints(), { delayBetweenScanAttempts: 300 });
    try {
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result) => {
          if (!result) return; // 프레임마다 인식 실패가 나는 것은 정상이므로 무시하고 계속 스캔
          onScanned(result.getText());
          stopScanning();
        }
      );
      controlsRef.current = controls;
      setState("scanning");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      // 카메라 권한/장치 오류만 남기고 민감정보(URL, 키 등)는 로그에 남기지 않는다.
      console.error("[scanner] failed to start", { name });
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState("permission-denied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setState("no-camera");
      } else {
        setState("init-error");
      }
    } finally {
      startingRef.current = false;
    }
  }

  const isActive = state === "starting" || state === "scanning";
  const errorMessage =
    state === "permission-denied"
      ? "카메라 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용하거나 ISBN을 직접 입력해 주세요."
      : state === "no-camera"
        ? "사용 가능한 카메라를 찾을 수 없습니다."
        : state === "init-error"
          ? "카메라를 시작하지 못했습니다. ISBN을 직접 입력해 주세요."
          : null;

  return (
    <div className="mt-2">
      {/* video는 항상 DOM에 유지하고 표시 여부만 전환한다 (스캔 시작 시 ref가 비어있는 문제 방지). */}
      <video
        ref={videoRef}
        muted
        playsInline
        className={`w-full rounded-xl bg-black ${isActive ? "block" : "hidden"}`}
      />

      {isActive ? (
        <>
          {state === "starting" && <p className="mt-1 text-xs text-stone-400">카메라 준비 중...</p>}
          <button
            type="button"
            onClick={stopScanning}
            className="mt-2 h-9 w-full rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 active:bg-stone-50"
          >
            취소
          </button>
        </>
      ) : (
        <>
          {errorMessage && <p className="mb-2 text-xs text-amber-700">{errorMessage}</p>}
          <button
            type="button"
            onClick={startScanning}
            className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:bg-emerald-700"
          >
            <span aria-hidden>📷</span> 바코드 스캔하기
          </button>
        </>
      )}
    </div>
  );
}
