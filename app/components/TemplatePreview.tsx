"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors app/lib/pdf.ts's Adjustment — duplicated instead of imported so
// this client component doesn't pull pdf-lib (server-only) into the
// browser bundle.
export interface Adjustment {
  scale: number;
  x: number;
  y: number;
}

export const DEFAULT_ADJUSTMENT: Adjustment = { scale: 1, x: 0.5, y: 0.5 };
// scale is relative to the minimum "cover" size (1 = exactly fills the
// slot, matching the old fixed behavior). Below 1 shrinks the photo
// smaller than the slot, leaving the slot's background showing around it.
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Mirrors the real-world cm dimensions in app/lib/pdf.ts (SLOTS / GAP_CM)
// so this preview lines up with what actually prints.
const ROWS: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftKey: string;
  rightKey: string;
  leftWidthCm: number;
  rightWidthCm: number;
  heightCm: number;
  gapCm: number;
  showGap: boolean;
  gapLabel?: string;
  gapKey?: string;
}[] = [
  {
    title: "Back",
    leftLabel: "Front",
    rightLabel: "Back",
    leftKey: "coverFront",
    rightKey: "coverBack",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.1,
    showGap: true,
    // The center strip is its own uploadable photo.
    gapLabel: "Gap",
    gapKey: "coverGap",
  },
  {
    title: "Cover",
    leftLabel: "Outer",
    rightLabel: "Inner",
    leftKey: "backOuter",
    rightKey: "backInner",
    leftWidthCm: 4.1,
    rightWidthCm: 4.1,
    heightCm: 4.1,
    gapCm: 1,
    showGap: false,
  },
  {
    title: "Packaging",
    leftLabel: "Text",
    rightLabel: "Image",
    leftKey: "packagingLeft",
    rightKey: "packagingRight",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.5,
    showGap: false,
  },
];

function ReplaceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Otherwise this bubbles up to the draggable parent's pointer
      // handlers as if a second finger/click had landed on the image —
      // handlePointerDown then tries to start a pinch-zoom with only one
      // real pointer, which crashes on the missing second point.
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Change photo"
      className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/70 transition-opacity"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
        <path
          d="M6 4.5h1.4l.8-1.2A1 1 0 0 1 9 2.8h2a1 1 0 0 1 .8.5l.8 1.2H14a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle cx="10" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
  );
}

function DeleteOverlay({
  visible,
  onDelete,
}: {
  visible: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className={`absolute inset-0 z-10 flex items-center justify-center bg-black/40 transition-opacity ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        type="button"
        onClick={onDelete}
        // Same reasoning as ReplaceButton — don't let this bubble up to
        // the draggable parent's pointer handlers.
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Remove photo"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground shadow-lg transition-transform hover:scale-105"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path
            d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4A1.5 1.5 0 0 0 7.6 17h4.8a1.5 1.5 0 0 0 1.5-1.6L14.5 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 9v5M11.5 9v5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function Slot({
  url,
  label,
  widthPercent,
  uploading,
  adjustment,
  onAdjustChange,
  onAddClick,
  onRemove,
}: {
  url?: string;
  label: string;
  widthPercent: number;
  uploading?: boolean;
  adjustment?: Adjustment;
  onAdjustChange: (next: Adjustment) => void;
  onAddClick: () => void;
  onRemove: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
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

  const adj = adjustment ?? DEFAULT_ADJUSTMENT;

  // object-position + transform:scale (the first version of this) turned
  // out not to work: object-position's pannable range is fixed by the
  // image/container aspect-ratio mismatch alone, computed *before* the
  // transform — zooming in doesn't add any range in whichever axis
  // already matched the container exactly at scale 1, so that axis
  // stayed stuck no matter how far in you zoomed. Sizing/positioning the
  // <img> directly in pixels (same formula as drawImageCover in
  // app/lib/pdf.ts) makes zoom actually expand both axes' pan range.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Reset the cached natural size when a new photo replaces this slot's
  // old one — done during render (React's documented pattern for
  // "adjust state when a prop changes"), not in an effect, so there's no
  // extra render still showing the old image's now-wrong dimensions.
  const [lastUrl, setLastUrl] = useState(url);
  const [showDelete, setShowDelete] = useState(false);
  if (url !== lastUrl) {
    setLastUrl(url);
    setNaturalSize(null);
    setShowDelete(false);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
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

  function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
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
        pinchRef.current.startScale = adj.scale;
      }
      dragRef.current = null;
      return;
    }

    if (dragRef.current && dragRef.current.pointerId !== e.pointerId) {
      // A second, different finger came down mid-drag — switch to
      // pinch-zoom.
      pinchRef.current = {
        pointers: new Map([
          [dragRef.current.pointerId, { x: dragRef.current.startClientX, y: dragRef.current.startClientY }],
          [e.pointerId, { x: e.clientX, y: e.clientY }],
        ]),
        startDist: 0,
        startScale: adj.scale,
      };
      const pts = Array.from(pinchRef.current.pointers.values());
      pinchRef.current.startDist = distance(pts[0], pts[1]);
      dragRef.current = null;
      return;
    }

    const size = drawSize(adj.scale);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startAdjustment: adj,
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
          ...adj,
          scale: clamp(pinchRef.current.startScale * ratio, MIN_SCALE, MAX_SCALE),
        });
      }
      return;
    }

    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
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
      if (pinchRef.current.pointers.size < 2) pinchRef.current = null;
      return;
    }
    if (dragRef.current?.pointerId === e.pointerId) {
      // A pointer down/up with (almost) no movement in between is a tap
      // rather than a drag — toggle the delete button instead of treating
      // it as a pan gesture. Also fires for a tap on the dark backdrop
      // itself, which is how the overlay dismisses without deleting.
      const moved = Math.hypot(
        e.clientX - dragRef.current.startClientX,
        e.clientY - dragRef.current.startClientY
      );
      dragRef.current = null;
      if (moved < 6) setShowDelete((prev) => !prev);
    }
  }

  // React's onWheel is passive by default, so e.preventDefault() inside
  // it is a no-op (and logs a warning) — a native listener is the only
  // way to actually stop the page from scrolling while zooming here.
  // latestRef sidesteps re-attaching the listener on every drag update;
  // it's kept fresh via its own effect since writing to a ref during
  // render itself isn't allowed.
  const latestRef = useRef({ url, adj, onAdjustChange });
  useEffect(() => {
    latestRef.current = { url, adj, onAdjustChange };
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      const { url, adj, onAdjustChange } = latestRef.current;
      if (!url) return;
      e.preventDefault();
      onAdjustChange({
        ...adj,
        scale: clamp(adj.scale - e.deltaY * 0.0015, MIN_SCALE, MAX_SCALE),
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Re-run when a slot flips from empty (<button>, no ref) to filled
    // (<div ref=containerRef>, …) so the listener actually gets attached
    // once there's something to attach it to.
  }, [url]);

  if (!url) {
    return (
      <button
        type="button"
        onClick={onAddClick}
        disabled={uploading}
        className="group relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden cursor-pointer disabled:cursor-wait"
        style={{ width: `${widthPercent}%` }}
      >
        <span className="text-brand/30 text-2xl leading-none">+</span>
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium transition-opacity ${
            uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {uploading ? "Uploading…" : "Add photo"}
        </span>
        <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-brand-dark/40">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden touch-none select-none cursor-move"
      style={{ width: `${widthPercent}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => onAdjustChange(DEFAULT_ADJUSTMENT)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        className="absolute pointer-events-none max-w-none"
        style={(() => {
          const size = drawSize(adj.scale);
          // Tailwind's preflight resets img to max-width:100% / height:auto,
          // which silently caps the explicit width/height below — without
          // overriding both here, a zoomed-in image (wider/taller than the
          // slot) gets squeezed back down, and the left/top math (worked
          // out for the *intended* size) ends up pointing at empty space.
          const base = { maxWidth: "none", maxHeight: "none" };
          // Before the image has loaded and the container's been
          // measured, fall back to a plain full-fill so nothing looks
          // broken for that first instant — this gets replaced by the
          // precise pixel placement below as soon as both are known.
          if (!size) {
            return { ...base, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const };
          }
          const left = (containerSize.w - size.width) * adj.x;
          const top = (containerSize.h - size.height) * adj.y;
          return { ...base, left, top, width: size.width, height: size.height };
        })()}
      />

      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium">
          Uploading…
        </span>
      )}

      {!uploading && (
        <DeleteOverlay
          visible={showDelete}
          onDelete={() => {
            setShowDelete(false);
            onRemove();
          }}
        />
      )}

      {!uploading && !showDelete && <ReplaceButton onClick={onAddClick} />}

      {!showDelete && (
        <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm pointer-events-none">
          <span className="bg-black/35 rounded px-1.5 py-0.5">{label}</span>
        </span>
      )}
    </div>
  );
}

function Row({
  row,
  leftUrl,
  rightUrl,
  gapUrl,
  leftUploading,
  rightUploading,
  gapUploading,
  leftAdjustment,
  rightAdjustment,
  gapAdjustment,
  onAdjustChange,
  onSlotClick,
  onRemove,
}: {
  row: (typeof ROWS)[number];
  leftUrl?: string;
  rightUrl?: string;
  gapUrl?: string;
  leftUploading?: boolean;
  rightUploading?: boolean;
  gapUploading?: boolean;
  leftAdjustment?: Adjustment;
  rightAdjustment?: Adjustment;
  gapAdjustment?: Adjustment;
  onAdjustChange: (slotKey: string, next: Adjustment) => void;
  onSlotClick: (slotKey: string) => void;
  onRemove: (slotKey: string) => void;
}) {
  // When the pair isn't meant to show a physical seam (Back, Packaging),
  // the two photos sit flush against each other — the gap only exists
  // for the width math of the real product (Cover).
  const totalWidthCm = row.showGap
    ? row.leftWidthCm + row.gapCm + row.rightWidthCm
    : row.leftWidthCm + row.rightWidthCm;
  const leftPct = (row.leftWidthCm / totalWidthCm) * 100;
  const gapPct = row.showGap ? (row.gapCm / totalWidthCm) * 100 : 0;
  const rightPct = (row.rightWidthCm / totalWidthCm) * 100;

  return (
    <div className="flex items-stretch gap-3">
      <div
        className="shrink-0 flex items-center justify-center text-[0.6rem] tracking-[0.3em] text-brand-dark/45 uppercase w-4"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {row.title}
      </div>

      <div className="flex items-stretch gap-2 w-full max-w-[480px]">
        <div className="flex-1">
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ aspectRatio: `${totalWidthCm} / ${row.heightCm}` }}
          >
            <Slot
              url={leftUrl}
              label={row.leftLabel}
              widthPercent={leftPct}
              uploading={leftUploading}
              adjustment={leftAdjustment}
              onAdjustChange={(next) => onAdjustChange(row.leftKey, next)}
              onAddClick={() => onSlotClick(row.leftKey)}
              onRemove={() => onRemove(row.leftKey)}
            />
            {row.showGap && row.gapKey && (
              <Slot
                url={gapUrl}
                label={row.gapLabel ?? "Gap"}
                widthPercent={gapPct}
                uploading={gapUploading}
                adjustment={gapAdjustment}
                onAdjustChange={(next) => onAdjustChange(row.gapKey!, next)}
                onAddClick={() => onSlotClick(row.gapKey!)}
                onRemove={() => onRemove(row.gapKey!)}
              />
            )}
            <Slot
              url={rightUrl}
              label={row.rightLabel}
              widthPercent={rightPct}
              uploading={rightUploading}
              adjustment={rightAdjustment}
              onAdjustChange={(next) => onAdjustChange(row.rightKey, next)}
              onAddClick={() => onSlotClick(row.rightKey)}
              onRemove={() => onRemove(row.rightKey)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatePreview({
  uploadedUrls,
  uploadingSlots,
  adjustments,
  onAdjustChange,
  onSlotClick,
  onRemove,
}: {
  uploadedUrls: Record<string, string>;
  uploadingSlots: Record<string, boolean>;
  adjustments: Record<string, Adjustment>;
  onAdjustChange: (slotKey: string, next: Adjustment) => void;
  onSlotClick: (slotKey: string) => void;
  onRemove: (slotKey: string) => void;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-6 sm:p-8 border border-brand/10 mb-10 max-w-2xl mx-auto">
      <div className="flex items-baseline gap-2 mb-6">
        <span className="font-script text-2xl text-brand leading-none">
          Gilly
        </span>
        <span className="text-[0.65rem] tracking-[0.3em] text-brand-dark/50 uppercase">
          NFC CD Keychain
        </span>
      </div>

      <p className="text-xs text-foreground/50 mb-6 -mt-2">
        Click any empty section to add a photo. Once added, drag to
        reposition and scroll/pinch to zoom.
      </p>

      <div className="space-y-6">
        {ROWS.map((row) => (
          <Row
            key={row.title}
            row={row}
            leftUrl={uploadedUrls[row.leftKey]}
            rightUrl={uploadedUrls[row.rightKey]}
            gapUrl={row.gapKey ? uploadedUrls[row.gapKey] : undefined}
            leftUploading={uploadingSlots[row.leftKey]}
            rightUploading={uploadingSlots[row.rightKey]}
            gapUploading={row.gapKey ? uploadingSlots[row.gapKey] : undefined}
            leftAdjustment={adjustments[row.leftKey]}
            rightAdjustment={adjustments[row.rightKey]}
            gapAdjustment={row.gapKey ? adjustments[row.gapKey] : undefined}
            onAdjustChange={onAdjustChange}
            onSlotClick={onSlotClick}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
