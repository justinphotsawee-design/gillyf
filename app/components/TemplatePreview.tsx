"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ADJUSTMENT,
  MIN_SCALE,
  MAX_SCALE,
  type Adjustment,
} from "../lib/adjustment";
import { useImageAdjust } from "./useImageAdjust";

// Re-exported for existing `from "./TemplatePreview"` imports (this file
// used to define these itself) — the real definitions live in
// app/lib/adjustment.ts, shared with useImageAdjust.ts. Also mirrors
// app/lib/pdf.ts's Adjustment, duplicated there instead of imported so
// that server-only module doesn't pull pdf-lib into this client
// component's browser bundle.
export { DEFAULT_ADJUSTMENT, MIN_SCALE, MAX_SCALE, type Adjustment };

// Mirrors the real-world cm dimensions in app/lib/pdf.ts (SLOTS / GAP_CM)
// so this preview lines up with what actually prints.
export const ROWS: {
  title: string;
  // Hides the vertical row title beside the slots (still used as the key).
  hideTitle?: boolean;
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
  // Set when the right box is fixed printed artwork rather than a photo
  // the customer uploads (see Packaging below) — points at the static
  // image to show instead of an "Add photo" dropzone.
  rightFixedUrl?: string;
}[] = [
  {
    title: "Back",
    hideTitle: true,
    leftLabel: "Back",
    rightLabel: "Inner right",
    leftKey: "coverFront",
    rightKey: "coverBack",
    leftWidthCm: 5,
    rightWidthCm: 4.5,
    heightCm: 3.8,
    gapCm: 1.1,
    showGap: true,
    // The center strip is its own uploadable photo.
    gapLabel: "Gap",
    gapKey: "coverGap",
  },
  {
    title: "Cover",
    hideTitle: true,
    leftLabel: "Front",
    rightLabel: "Inner left",
    leftKey: "backOuter",
    rightKey: "backInner",
    leftWidthCm: 4.1,
    rightWidthCm: 4.1,
    heightCm: 4.2,
    gapCm: 1,
    showGap: false,
  },
  {
    title: "Packaging",
    leftLabel: "",
    rightLabel: "Image",
    leftKey: "packagingLeft",
    rightKey: "packagingRight",
    leftWidthCm: 6.5,
    rightWidthCm: 6.5,
    heightCm: 10.2,
    gapCm: 1.5,
    showGap: false,
    rightFixedUrl: "/pic/packaging-right_new.png",
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
  const adj = adjustment ?? DEFAULT_ADJUSTMENT;

  // Reset the delete overlay (but deliberately *not* any image geometry —
  // see useImageAdjust's naturalSize comment) when a new photo replaces
  // this slot's old one — done during render (React's documented pattern
  // for "adjust state when a prop changes"), not in an effect, so there's
  // no extra render still showing the old delete-overlay state.
  const [lastUrl, setLastUrl] = useState(url);
  const [showDelete, setShowDelete] = useState(false);
  if (url !== lastUrl) {
    setLastUrl(url);
    setShowDelete(false);
  }

  // A tap opens the delete overlay with its "Remove photo" button centered
  // right under the finger/cursor — the second tap of a double-click (meant
  // to hit the double-click-to-reset gesture below) then lands squarely on
  // that button and deletes the photo instead. Deferring the toggle lets a
  // same-spot second tap arrive in time to cancel it, so a real double-click
  // resets zoom like it's supposed to instead of deleting the photo.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs can't be touched during render (see the state resets above,
  // which use React's blessed "adjust state when a prop changes"
  // pattern instead) — so the pending-tap timer is cleared here instead,
  // keyed on the same `url` change plus unmount.
  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, [url]);

  function handleTap() {
    // A tap on the dark backdrop itself is how the overlay dismisses
    // without deleting.
    if (showDelete) {
      // Dismissing: nothing new is about to appear under the pointer, so
      // there's no race to guard against here.
      setShowDelete(false);
    } else if (tapTimerRef.current) {
      // This is the second tap of a double-click arriving before the
      // first tap's deferred open below fired — treat the pair as the
      // double-click-to-reset gesture (see onDoubleClick), not two single
      // taps.
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    } else {
      // Defer opening the delete overlay: if a second same-spot tap
      // (i.e. a double-click) arrives within the window above, it
      // cancels this instead of landing on the "Remove photo" button
      // that would otherwise have just appeared under the cursor.
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setShowDelete(true);
      }, 300);
    }
  }

  const {
    containerRef,
    imgRef,
    imgStyle,
    onImgLoad,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDoubleClick,
  } = useImageAdjust({ url, adjustment: adj, onAdjustChange, onTap: handleTap });

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
        {label && (
          <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-brand-dark/40">
            {label}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden touch-none select-none cursor-move"
      style={{ width: `${widthPercent}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt=""
        draggable={false}
        onLoad={onImgLoad}
        className="absolute pointer-events-none max-w-none"
        style={imgStyle}
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

      {!showDelete && label && (
        <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm pointer-events-none">
          <span className="bg-black/35 rounded px-1.5 py-0.5">{label}</span>
        </span>
      )}
    </div>
  );
}

// Fixed printed artwork (Packaging's right box) — not a photo the
// customer uploads, so no click-to-add, drag, zoom, or remove; just a
// static preview of what actually prints there.
function FixedSlot({
  url,
  label,
  widthPercent,
}: {
  url: string;
  label: string;
  widthPercent: number;
}) {
  return (
    <div
      className="relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden"
      style={{ width: `${widthPercent}%` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
      />
      <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm pointer-events-none">
        <span className="bg-black/35 rounded px-1.5 py-0.5">{label}</span>
      </span>
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
        {!row.hideTitle && row.title}
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
            {row.rightFixedUrl ? (
              <FixedSlot
                url={row.rightFixedUrl}
                label={row.rightLabel}
                widthPercent={rightPct}
              />
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// The actual editable grid — every row of Slot/FixedSlot pairs, with no
// card/header/logo wrapper of its own. Exported (not just used by the
// default export below) so order/OrderClient.tsx can drop it straight
// into /order's own header/card instead of nesting TemplatePreview's card
// inside that page's, or maintaining a second, near-identical grid
// component that could drift out of sync with this one.
export function SlotGrid({
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
  );
}

export default function TemplatePreview(
  props: Parameters<typeof SlotGrid>[0]
) {
  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-6 sm:p-8 border border-brand/10 mb-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <img
          src="/pic/logo_new_white.png"
          alt="Gilly"
          width={1765}
          height={1089}
          className="h-10 w-auto object-contain"
        />
        <span className="text-[0.65rem] tracking-[0.3em] text-brand-dark/50 uppercase">
          NFC CD Keychain
        </span>
      </div>

      <p className="text-xs text-foreground/50 mb-6 -mt-2">
        Click any empty section to add a photo. Once added, drag to
        reposition and scroll/pinch to zoom.
      </p>

      <SlotGrid {...props} />
    </div>
  );
}
