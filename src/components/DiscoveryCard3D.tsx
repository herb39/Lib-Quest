"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type DiscoveryCard3DProps = {
  /** 이미 발견해 표지가 공개된 카드인지 여부. */
  revealed: boolean;
  coverUrl?: string | null;
  title?: string | null;
  /** 방금 발견해 flip 연출을 재생해야 하는 카드인지 여부. */
  justRevealed?: boolean;
  /** 현재 탐색 중인 카드(은은한 idle motion 대상)인지 여부. */
  active?: boolean;
  /** PC pointer tilt / 모바일 touch tilt를 켤지 여부. */
  interactive?: boolean;
  size?: "slot" | "active" | "grid";
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const TILT_MAX_Y = 6; // rotateY deg
const TILT_MAX_X = 4; // rotateX deg

export function DiscoveryCard3D({
  revealed,
  coverUrl,
  title,
  justRevealed = false,
  active = false,
  interactive = true,
  size = "active",
}: DiscoveryCard3DProps) {
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [interacting, setInteracting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImgError(false);
     
    setImgLoaded(false);
  }, [coverUrl]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  function setTilt(rotateX: number, rotateY: number, scale: number) {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
  }

  function resetTilt() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tiltRef.current) tiltRef.current.style.transform = "";
  }

  // 데스크톱: pointermove로 카드 중심 대비 포인터 위치를 계산해 아주 약하게 기울인다.
  function handlePointerEnter(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion || e.pointerType !== "mouse") return;
    rectRef.current = tiltRef.current?.getBoundingClientRect() ?? null;
    setInteracting(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion || e.pointerType !== "mouse") return;
    const rect = rectRef.current;
    if (!rect) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * TILT_MAX_Y * 2;
      const rotateX = -(py - 0.5) * TILT_MAX_X * 2;
      setTilt(rotateX, rotateY, 1.02);
    });
  }

  function handlePointerLeave(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") {
      setInteracting(false);
      resetTilt();
    }
  }

  // 모바일: 세로 스크롤을 막지 않기 위해 pointermove는 추적하지 않고,
  // 누른 위치 기준 한 번만 살짝 기울인 뒤 손을 떼면 원위치로 되돌린다.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion || e.pointerType === "mouse") return;
    const rect = tiltRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setInteracting(true);
    setTilt(-(py - 0.5) * TILT_MAX_X, (px - 0.5) * TILT_MAX_Y, 1.015);
  }

  function handlePointerUpOrCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    setInteracting(false);
    resetTilt();
  }

  // justRevealed인 카드는 마운트 시 숨김 상태로 그린 뒤 다음 tick에 revealed로 전환해
  // CSS transition(rotateY flip)이 실제로 재생되게 한다. 이미 발견된 슬롯/도감 카드는
  // 곧바로 최종 상태로 표시한다(불필요한 애니메이션 반복 방지).
  const [displayRevealed, setDisplayRevealed] = useState(justRevealed ? false : revealed);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (justRevealed && revealed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayRevealed(false);
      const t = setTimeout(() => {
        setDisplayRevealed(true);
        if (!reducedMotion) {
          setPulsing(true);
          setTimeout(() => setPulsing(false), 500);
        }
      }, 60);
      return () => clearTimeout(t);
    }
     
    setDisplayRevealed(revealed);
  }, [revealed, justRevealed, reducedMotion]);

  const idleEligible = active && !displayRevealed && !interacting;
  const flipClass = reducedMotion ? "lq-reduced-motion" : "";

  return (
    <div
      ref={tiltRef}
      className={`lq-card3d-tilt h-full w-full ${idleEligible ? "lq-card3d-idle" : ""} ${
        interacting ? "lq-card3d-interacting" : ""
      } ${pulsing ? "lq-card3d-pulse" : ""}`}
      style={{ touchAction: "pan-y" }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
    >
      <div className={`lq-card3d-flip ${flipClass} ${displayRevealed ? "is-revealed" : ""}`}>
        <div className="lq-card3d-face lq-card3d-front flex flex-col items-center justify-center border border-stone-200 bg-white shadow-sm">
          <span aria-hidden="true" className="text-2xl font-bold text-stone-300">
            ?
          </span>
          {size !== "slot" && <p className="mt-1 text-[11px] font-medium text-stone-400">숨겨진 책</p>}
        </div>

        <div className="lq-card3d-face lq-card3d-back flex flex-col border border-stone-200 bg-white shadow-sm">
          <div className="relative flex-1 bg-stone-100">
            {coverUrl && !imgError ? (
              // 외부 표지 이미지 호스트가 여러 곳(aladin/naver)이라 next/image remotePatterns를
              // 무분별하게 넓히는 대신 일반 img로 안전하게 처리한다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                  imgLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-stone-400">
                <span aria-hidden="true" className="text-xl">
                  📕
                </span>
                {size !== "slot" && <span className="text-[10px]">표지 이미지 없음</span>}
              </div>
            )}
          </div>
          {size !== "slot" && (
            <div className="shrink-0 px-2 py-1.5 text-center">
              {title && <p className="line-clamp-2 break-keep text-[11px] font-semibold text-stone-900">{title}</p>}
              <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">발견 완료 ✓</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
