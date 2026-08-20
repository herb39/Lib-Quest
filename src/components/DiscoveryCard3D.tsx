"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type DiscoveryCard3DProps = {
  /** 이미 발견해 표지가 공개된 책인지 여부. */
  revealed: boolean;
  coverUrl?: string | null;
  title?: string | null;
  /** 방금 발견해 reveal 연출을 재생해야 하는 책인지 여부. */
  justRevealed?: boolean;
  /** 현재 탐색 중인 책(은은한 idle motion 대상)인지 여부. */
  active?: boolean;
  /** PC pointer tilt / 모바일 touch tilt를 켤지 여부. */
  interactive?: boolean;
  /** hero: Discovery 화면의 매우 큰 주인공 책. active/grid: 캡션 포함 중간 크기. slot: 진행 슬롯의 미니어처. */
  size?: "slot" | "active" | "grid" | "hero";
  /** 제목/"발견 완료" 캡션 노출 여부. 생략하면 size 기준 기본값(active/grid만 노출)을 따른다. */
  caption?: boolean;
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

const TILT_MAX_Y = 6; // rotateY deg, pointer 추가분
const TILT_MAX_X = 4; // rotateX deg, pointer 추가분

/**
 * 책 한 권의 "숨김 ↔ 발견" 상태를 표현하는 순수 CSS 3D 오브젝트.
 * 단순 flip 카드가 아니라 표지(cover)/책등(spine)/페이지 단면(pages)/뒤표지(back)를
 * 겹겹이 쌓고 살짝 기울여(perspective + rotateX/Y/Z) 두께가 있는 책처럼 보이게 한다.
 * transform은 역할별로 레이어를 분리한다 — 이렇게 나눠야 pointer tilt·idle motion·
 * reveal 연출이 같은 transform을 두고 서로 덮어쓰며 충돌하지 않는다.
 *
 *   lq-book-scene    (perspective)
 *   └ lq-book-interact (ref: pointer tilt/idle 전용 — JS가 style.transform을 직접 갱신)
 *     └ lq-book-reveal  (발견 순간의 1회성 materialize 애니메이션 전용)
 *       └ lq-book-pose    (책의 고정 기본 각도: rotateX(3) rotateY(-10) rotateZ(-1))
 *         └ 표지/책등/페이지/뒤표지 레이어
 */
export function DiscoveryCard3D({
  revealed,
  coverUrl,
  title,
  justRevealed = false,
  active = false,
  interactive = true,
  size = "active",
  caption,
}: DiscoveryCard3DProps) {
  const interactRef = useRef<HTMLDivElement | null>(null);
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
    const el = interactRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
  }

  function resetTilt() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (interactRef.current) interactRef.current.style.transform = "";
  }

  // 데스크톱: pointermove로 카드 중심 대비 포인터 위치를 계산해 아주 약하게 기울인다.
  function handlePointerEnter(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion || e.pointerType !== "mouse") return;
    rectRef.current = interactRef.current?.getBoundingClientRect() ?? null;
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
    const rect = interactRef.current?.getBoundingClientRect();
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

  // justRevealed인 책은 마운트 시 숨김 상태로 그린 뒤 다음 tick에 revealed로 전환해
  // materialize 애니메이션이 실제로 재생되게 한다. 이미 발견된 슬롯/도감 책은
  // 곧바로 최종 상태로 표시한다(불필요한 애니메이션 반복 방지).
  const [displayRevealed, setDisplayRevealed] = useState(justRevealed ? false : revealed);
  const [materializing, setMaterializing] = useState(false);

  useEffect(() => {
    if (justRevealed && revealed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayRevealed(false);
      const t = setTimeout(() => {
        setDisplayRevealed(true);
        if (!reducedMotion) {
          setMaterializing(true);
          setTimeout(() => setMaterializing(false), 900);
        }
      }, 60);
      return () => clearTimeout(t);
    }
     
    setDisplayRevealed(revealed);
  }, [revealed, justRevealed, reducedMotion]);

  const idleEligible = active && !displayRevealed && !interacting;
  const sizeClass =
    size === "hero" ? "lq-book--hero" : size === "slot" ? "lq-book--slot" : size === "grid" ? "lq-book--grid" : "lq-book--active";
  const showCaption = caption ?? (size === "active" || size === "grid");

  return (
    <div className="flex h-full w-full flex-col">
      <div className={`lq-book-scene relative flex-1 ${sizeClass}`}>
      <div
        ref={interactRef}
        className={`lq-book-interact h-full w-full ${interacting || idleEligible ? "lq-book-will-change" : ""}`}
        style={{ touchAction: "pan-y" }}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
      >
        <div
          className={`lq-book-reveal h-full w-full ${materializing ? "lq-book-materialize" : ""} ${
            idleEligible ? "lq-book-idle" : ""
          }`}
        >
          <div className="lq-book-pose">
            <div className="lq-book-face lq-book-back" aria-hidden="true" />
            <div className="lq-book-face lq-book-pages" aria-hidden="true" />
            <div className="lq-book-face lq-book-spine" aria-hidden="true" />
            <div className="lq-book-face lq-book-cover">
              <div className={`lq-book-cover-layer ${!displayRevealed ? "is-visible" : ""}`}>
                <span aria-hidden="true" className="lq-book-mark">
                  ?
                </span>
                {size !== "slot" && <p className="mt-1 text-[11px] font-medium text-stone-400">숨겨진 책</p>}
              </div>
              <div className={`lq-book-cover-layer ${displayRevealed ? "is-visible" : ""}`}>
                {coverUrl && !imgError ? (
                  // 외부 표지 이미지 호스트가 여러 곳(aladin/naver)이라 next/image remotePatterns를
                  // 무분별하게 넓히는 대신 일반 img로 안전하게 처리한다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    onError={() => setImgError(true)}
                    onLoad={() => setImgLoaded(true)}
                    className={`h-full w-full object-cover transition-opacity duration-200 ${
                      imgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-stone-100 text-stone-400">
                    <span aria-hidden="true" className="text-xl">
                      📕
                    </span>
                    {size !== "slot" && <span className="text-[10px]">표지 이미지 없음</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
        <div className={`lq-book-shadow ${materializing ? "lq-book-shadow-float" : ""}`} aria-hidden="true" />
      </div>
      {showCaption && (
        <div className="mt-1.5 shrink-0 px-1 text-center">
          {title && <p className="line-clamp-2 break-keep text-[11px] font-semibold text-stone-900">{title}</p>}
          {displayRevealed && <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">발견 완료 ✓</p>}
        </div>
      )}
    </div>
  );
}
