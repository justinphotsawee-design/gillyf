"use client";

import { useEffect, useRef, useState } from "react";
import { ROWS, DEFAULT_ADJUSTMENT, type Adjustment } from "./TemplatePreview";

// Read-only sibling of TemplatePreview.tsx's Slot — same "cover" fit math
// (see that file's drawSize comment for why pixel placement is needed
// instead of object-position), just without the drag/pinch/replace/delete
// handlers, since this renders the finished /order link a customer shares
// into LINE for the shop to view, not something they edit.
function CoverImage({ url, adjustment }: { url: string; adjustment: Adjustment }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function drawSize() {
    if (!naturalSize || !containerSize.w || !containerSize.h) return null;
    const coverScale = Math.max(
      containerSize.w / naturalSize.w,
      containerSize.h / naturalSize.h
    );
    const scale = coverScale * adjustment.scale;
    return { width: naturalSize.w * scale, height: naturalSize.h * scale };
  }

  const size = drawSize();
  const base = { maxWidth: "none", maxHeight: "none" } as const;
  const style = size
    ? {
        ...base,
        left: (containerSize.w - size.width) * adjustment.x,
        top: (containerSize.h - size.height) * adjustment.y,
        width: size.width,
        height: size.height,
      }
    : { ...base, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        className="absolute pointer-events-none select-none"
        style={style}
      />
    </div>
  );
}

function Slot({
  url,
  label,
  widthPercent,
  adjustment,
}: {
  url?: string;
  label: string;
  widthPercent: number;
  adjustment?: Adjustment;
}) {
  return (
    <div
      className="relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden"
      style={{ width: `${widthPercent}%` }}
    >
      {url && <CoverImage url={url} adjustment={adjustment ?? DEFAULT_ADJUSTMENT} />}
      <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm pointer-events-none">
        <span className="bg-black/35 rounded px-1.5 py-0.5">{label}</span>
      </span>
    </div>
  );
}

function Row({
  row,
  images,
  adjustments,
}: {
  row: (typeof ROWS)[number];
  images: Record<string, string>;
  adjustments: Record<string, Adjustment>;
}) {
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
              url={images[row.leftKey]}
              label={row.leftLabel}
              widthPercent={leftPct}
              adjustment={adjustments[row.leftKey]}
            />
            {row.showGap && row.gapKey && (
              <Slot
                url={images[row.gapKey]}
                label={row.gapLabel ?? "Gap"}
                widthPercent={gapPct}
                adjustment={adjustments[row.gapKey]}
              />
            )}
            <Slot
              url={row.rightFixedUrl ?? images[row.rightKey]}
              label={row.rightLabel}
              widthPercent={rightPct}
              adjustment={row.rightFixedUrl ? DEFAULT_ADJUSTMENT : adjustments[row.rightKey]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderPreview({
  images,
  adjustments,
}: {
  images: Record<string, string>;
  adjustments: Record<string, Adjustment>;
}) {
  return (
    <div className="space-y-6">
      {ROWS.map((row) => (
        <Row key={row.title} row={row} images={images} adjustments={adjustments} />
      ))}
    </div>
  );
}
