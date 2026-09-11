"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ADJUSTMENT,
  MIN_SCALE,
  MAX_SCALE,
  clamp,
  type Adjustment,
} from "../lib/adjustment";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Drives the drag-to-pan / pinch-to-zoom / scroll-to-zoom / double-click-
// to-reset gesture behind TemplatePreview.tsx's editable Slot — the same
// grid component the customize page and, via its exported SlotGrid, the
// /order link (order/OrderClient.tsx) both render, so this hook only has
// the one call site to stay in sync with. Pulled out of Slot into its own
// hook anyway, since "cover fit sized/positioned in pixels, not object-
// position" math (object-position's pannable range is fixed by the image/
// container aspect-ratio mismatch alone, computed *before* any transform —
// zooming in doesn't add range in whichever axis already matched the
// container exactly at scale 1) is easy to get subtly wrong, and keeping
// it isolated makes that easier to test and reason about on its own.
export function useImageAdjust({
  url,
  adjustment,
  onAdjustChange,
  onTap,
}: {
  url: string | undefined;
  adjustment: Adjustment;
  onAdjustChange: (next: Adjustment) => void;
  // Fires on pointerup when the gesture turned out to be a tap (near-zero
  // movement) rather than a drag — Slot uses this to toggle its delete
  // overlay.
  onTap?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    // Updated on every move — unlike startClientX/Y, which stays pinned
    // to the down-position for the whole drag. Needed so that if a
    // second finger lands mid-drag (starting a pinch), the pinch can
    // seed itself from where the first finger actually is *now* rather
    // than where it was when it first touched down.
    lastClientX: number;
    lastClientY: number;
    startAdjustment: Adjustment;
    // Pan range in each axis at drag-start (container size minus the
    // drawn image size at that zoom level) — captured once so a fast
    // drag stays consistent even as onAdjustChange re-renders mid-drag.
    panRangeX: number;
    panRangeY: number;
  } | null>(null);
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDist: number;
    startScale: number;
  } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  // Deliberately never reset naturalSize when `url` changes. A slot's url
  // can flip twice for the same photo — once to a local blob: preview,
  // then again to the final hosted URL once the upload finishes — and
  // that second flip needs a fresh network fetch/decode. Nulling
  // naturalSize on every url change used to leave drawSize() returning
  // null for that whole in-between window: any drag/zoom right as an
  // upload finished was silently dropped (state updated, but nothing
  // visibly moved, since the fallback render below ignores
  // adjustment.scale/x/y), and once the real image's onLoad finally
  // fired, it would jump straight to whatever extreme scale/position had
  // piled up meanwhile — reading as the slot being permanently stuck
  // zoomed in and unresponsive. Keeping the previous image's dimensions
  // around (almost always the *same* photo, just a different URL) means
  // drawSize keeps returning real geometry throughout, so dragging/
  // zooming never goes dead; onLoad below still corrects naturalSize the
  // moment the new image actually reports its real dimensions.

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
    // Re-run when a slot flips from empty (no ref yet) to filled so the
    // observer actually gets attached once there's something to observe.
  }, [url]);

  function drawSize(userScale: number) {
    if (!naturalSize || !containerSize.w || !containerSize.h) return null;
    const coverScale = Math.max(
      containerSize.w / naturalSize.w,
      containerSize.h / naturalSize.h
    );
    const scale = coverScale * userScale;
    return { width: naturalSize.w * scale, height: naturalSize.h * scale };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!url) return;
    // Best-effort: keeps move/up events coming to this element even if
    // the finger/cursor drifts outside it mid-drag. It can throw (e.g. a
    // pointer that's already gone up by the time this runs) — that's not
    // fatal, so don't let it stop the rest of the gesture from starting.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored — see above.
    }

    if (pinchRef.current) {
      pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = Array.from(pinchRef.current.pointers.values());
      if (pts.length === 2) {
        pinchRef.current.startDist = distance(pts[0], pts[1]);
        pinchRef.current.startScale = adjustment.scale;
      }
      dragRef.current = null;
      return;
    }

    if (dragRef.current && dragRef.current.pointerId !== e.pointerId) {
      // A second, different finger came down mid-drag — switch to
      // pinch-zoom. Seed the first finger's point from its *current*
      // (last-moved-to) position, not its original down-position — the
      // two touches essentially never land in the same instant, so by
      // the time the second finger arrives the first one has usually
      // already drifted. Using the stale down-position here skews
      // startDist away from the real initial finger separation, which
      // then either overshoots or undershoots every ratio computed
      // afterwards — the zoom gesture reads as unresponsive or stuck,
      // especially when it makes startDist too large to ever exceed
      // while spreading fingers apart (i.e. "can't zoom in").
      pinchRef.current = {
        pointers: new Map([
          [dragRef.current.pointerId, { x: dragRef.current.lastClientX, y: dragRef.current.lastClientY }],
          [e.pointerId, { x: e.clientX, y: e.clientY }],
        ]),
        startDist: 0,
        startScale: adjustment.scale,
      };
      const pts = Array.from(pinchRef.current.pointers.values());
      pinchRef.current.startDist = distance(pts[0], pts[1]);
      dragRef.current = null;
      return;
    }

    const size = drawSize(adjustment.scale);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      startAdjustment: adjustment,
      panRangeX: size ? containerSize.w - size.width : 0,
      panRangeY: size ? containerSize.h - size.height : 0,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchRef.current?.pointers.has(e.pointerId)) {
      pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = Array.from(pinchRef.current.pointers.values());
      if (pts.length === 2 && pinchRef.current.startDist > 0) {
        const ratio = distance(pts[0], pts[1]) / pinchRef.current.startDist;
        onAdjustChange({
          ...adjustment,
          scale: clamp(pinchRef.current.startScale * ratio, MIN_SCALE, MAX_SCALE),
        });
      }
      return;
    }

    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.lastClientX = e.clientX;
    dragRef.current.lastClientY = e.clientY;
    const deltaX = e.clientX - dragRef.current.startClientX;
    const deltaY = e.clientY - dragRef.current.startClientY;
    const { startAdjustment, panRangeX, panRangeY } = dragRef.current;
    // panRangeX/Y (container size minus the drawn image size, at the
    // zoom level when the drag started) is negative once the image
    // overflows the box — dividing by it is what flips "drag right" into
    // "focal point moves left", i.e. the image visually follows the
    // finger/cursor. It's 0 only if the image exactly fits (no zoom, no
    // slack), in which case there's nothing to pan in that axis anyway.
    onAdjustChange({
      ...startAdjustment,
      x: panRangeX ? clamp(startAdjustment.x + deltaX / panRangeX, 0, 1) : startAdjustment.x,
      y: panRangeY ? clamp(startAdjustment.y + deltaY / panRangeY, 0, 1) : startAdjustment.y,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchRef.current?.pointers.has(e.pointerId)) {
      pinchRef.current.pointers.delete(e.pointerId);
      if (pinchRef.current.pointers.size < 2) {
        // One finger lifted mid-pinch. Resume as a plain drag with
        // whichever finger is still down instead of going dead — without
        // this, the still-down finger's moves are silently dropped
        // (neither ref claims that pointerId anymore) until it also
        // lifts, which reads as "zoom just stopped working".
        const remaining = Array.from(pinchRef.current.pointers.entries())[0];
        pinchRef.current = null;
        if (remaining) {
          const [remainingId, pos] = remaining;
          const size = drawSize(adjustment.scale);
          dragRef.current = {
            pointerId: remainingId,
            startClientX: pos.x,
            startClientY: pos.y,
            lastClientX: pos.x,
            lastClientY: pos.y,
            startAdjustment: adjustment,
            panRangeX: size ? containerSize.w - size.width : 0,
            panRangeY: size ? containerSize.h - size.height : 0,
          };
        }
      }
      return;
    }
    if (dragRef.current?.pointerId === e.pointerId) {
      // A pointer down/up with (almost) no movement in between is a tap
      // rather than a drag.
      const moved = Math.hypot(
        e.clientX - dragRef.current.startClientX,
        e.clientY - dragRef.current.startClientY
      );
      dragRef.current = null;
      if (moved < 6) onTap?.();
    }
  }

  // React's onWheel is passive by default, so e.preventDefault() inside
  // it is a no-op (and logs a warning) — a native listener is the only
  // way to actually stop the page from scrolling while zooming here.
  // latestRef sidesteps re-attaching the listener on every drag update;
  // it's kept fresh via its own effect since writing to a ref during
  // render itself isn't allowed.
  const latestRef = useRef({ url, adjustment, onAdjustChange });
  useEffect(() => {
    latestRef.current = { url, adjustment, onAdjustChange };
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      const { url, adjustment, onAdjustChange } = latestRef.current;
      if (!url) return;
      e.preventDefault();
      onAdjustChange({
        ...adjustment,
        scale: clamp(adjustment.scale - e.deltaY * 0.0015, MIN_SCALE, MAX_SCALE),
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Re-run when a slot flips from empty to filled so the listener
    // actually gets attached once there's something to attach it to.
  }, [url]);

  function reportSize(img: HTMLImageElement) {
    // Guard against a no-op update: imgRef below is a fresh function
    // identity every render, so React calls it (null, then the element)
    // on every render, not just mount — without this check, that would
    // set an equal-but-newly-allocated {w,h} object each time, and each
    // set-state triggers exactly the re-render that calls imgRef again,
    // forever.
    setNaturalSize((prev) =>
      prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight
        ? prev
        : { w: img.naturalWidth, h: img.naturalHeight }
    );
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    reportSize(e.currentTarget);
  }

  // A same-origin (or already-cached) image can finish loading before
  // React's onLoad listener has attached — the server-rendered HTML
  // already contains the <img src>, so the browser can start (and, for a
  // fast local asset, finish) fetching it during initial parse, well
  // before hydration runs. A 'load' event never fires for an
  // already-complete image in that case, so onLoad above never gets
  // called and naturalSize stays null forever — permanently disabling
  // zoom/pan for that photo (the fallback render below looks identical
  // to a correct default-zoom render, which is why this can go
  // unnoticed until someone actually tries to adjust that specific
  // photo). A callback ref runs at DOM-commit time, the earliest point
  // this component can check `.complete` itself, so it catches that case
  // in addition to onLoad handling the normal (still-loading) one.
  function imgRef(img: HTMLImageElement | null) {
    if (img && img.complete && img.naturalWidth > 0) {
      reportSize(img);
    }
  }

  // Tailwind's preflight resets img to max-width:100% / height:auto,
  // which silently caps the explicit width/height below — without
  // overriding both here, a zoomed-in image (wider/taller than the slot)
  // gets squeezed back down, and the left/top math (worked out for the
  // *intended* size) ends up pointing at empty space.
  const imgStyle = (() => {
    const size = drawSize(adjustment.scale);
    const base = { maxWidth: "none", maxHeight: "none" } as const;
    // Before the image has loaded and the container's been measured,
    // fall back to a plain full-fill so nothing looks broken for that
    // first instant — this gets replaced by the precise pixel placement
    // below as soon as both are known.
    if (!size) {
      return { ...base, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const };
    }
    const left = (containerSize.w - size.width) * adjustment.x;
    const top = (containerSize.h - size.height) * adjustment.y;
    return { ...base, left, top, width: size.width, height: size.height };
  })();

  return {
    containerRef,
    imgRef,
    imgStyle,
    onImgLoad,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onDoubleClick: () => onAdjustChange(DEFAULT_ADJUSTMENT),
  };
}
