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

const TILT_MAX_Y = 6; // 데스크톱 rotateY deg, pointer 추가분
const TILT_MAX_X = 4; // 데스크톱 rotateX deg, pointer 추가분
const TOUCH_TILT_MAX_Y = 9; // 모바일 rotateY deg(좌우) — spine/page edge 노출 변화가 육안으로 느껴지도록
const TOUCH_TILT_MAX_X = 7; // 모바일 rotateX deg(상하) — 세로 이동에서도 확실히 체감되도록
const TOUCH_TILT_SCALE = 1.025; // 터치 중 살짝 들어올려지는 느낌
// 터치는 카드 중앙에서 조금만 움직여도 변화가 느껴지도록 정규화된 offset에 곱하는 민감도.
// max deg 자체를 더 키우는 대신 "center 근처에서의 반응 속도"만 높이고, 결과는 항상 ±max로 clamp한다.
const TOUCH_TILT_SENSITIVITY = 1.2;

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

  function applyTilt(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    maxX: number,
    maxY: number,
    scale: number,
    sensitivity: number = 1
  ) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      // -1..1로 정규화한 offset에 sensitivity를 곱해 중앙 근처에서도 반응이 빨리 시작되게 하되,
      // 항상 ±1로 clamp한 뒤 max deg를 곱한다 — sensitivity가 max deg 자체를 넘어서게 만들지 않는다.
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      const offsetY = clamp((px - 0.5) * 2 * sensitivity);
      const offsetX = clamp((py - 0.5) * 2 * sensitivity);
      const rotateY = offsetY * maxY;
      const rotateX = -offsetX * maxX;
      setTilt(rotateX, rotateY, scale);
    });
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion) return;
    const rect = rectRef.current;
    if (!rect) return;
    if (e.pointerType === "mouse") {
      applyTilt(e.clientX, e.clientY, rect, TILT_MAX_X, TILT_MAX_Y, 1.02);
      return;
    }
    // 모바일: pointerdown에서 저장해둔 rect 기준으로 손가락 위치를 계속 따라간다.
    // preventDefault를 호출하지 않고 touch-action: pan-y를 유지하므로, 제스처가 세로
    // 스크롤로 판단되면 브라우저가 자체적으로 pointercancel을 보내 추적이 자연스럽게 멈춘다.
    // interacting(React state)이 아니라 rectRef(동기 ref)로만 게이팅한다 — pointerdown 직후
    // 곧바로 이어지는 pointermove가 아직 커밋되지 않은 setInteracting(true)의 stale closure를
    // 만나 프레임을 놓치는 것을 막기 위함이다.
    applyTilt(e.clientX, e.clientY, rect, TOUCH_TILT_MAX_X, TOUCH_TILT_MAX_Y, TOUCH_TILT_SCALE, TOUCH_TILT_SENSITIVITY);
  }

  function handlePointerLeave(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") {
      setInteracting(false);
      resetTilt();
    }
  }

  // 모바일: 누른 위치 기준으로 즉시 한 번 기울이고, 이후 pointermove로 계속 따라간다.
  // 세로 스크롤을 막지 않기 위해 setPointerCapture/preventDefault는 사용하지 않는다 —
  // Hero Book이 화면의 상당 부분을 차지해 제스처 도중 손가락이 영역을 벗어나는 경우가
  // 드물어, capture 없이도 실사용에서 충분히 자연스럽게 따라온다.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || reducedMotion || e.pointerType === "mouse") return;
    const rect = interactRef.current?.getBoundingClientRect();
    if (!rect) return;
    rectRef.current = rect;
    setInteracting(true);
    applyTilt(e.clientX, e.clientY, rect, TOUCH_TILT_MAX_X, TOUCH_TILT_MAX_Y, TOUCH_TILT_SCALE, TOUCH_TILT_SENSITIVITY);
  }

  function handlePointerUpOrCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    setInteracting(false);
    resetTilt();
    rectRef.current = null;
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
