"use client";

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
  gapImageKey?: string;
}[] = [
  {
    title: "Cover",
    leftLabel: "Front",
    rightLabel: "Back",
    leftKey: "coverFront",
    rightKey: "coverBack",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.5,
    showGap: true,
    // The center strip shows a sliver cropped from the middle of the Back
    // Inner photo instead of sitting empty.
    gapImageKey: "backInner",
  },
  {
    title: "Back",
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

function Slot({
  url,
  label,
  widthPercent,
  uploading,
  onClick,
}: {
  url?: string;
  label: string;
  widthPercent: number;
  uploading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      className="group relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden cursor-pointer disabled:cursor-wait"
      style={{ width: `${widthPercent}%` }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-brand/30 text-2xl leading-none">+</span>
      )}

      {/* Hover/tap affordance for adding or replacing the photo */}
      <span
        className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium transition-opacity ${
          uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      >
        {uploading ? "Uploading…" : url ? "Change photo" : "Add photo"}
      </span>

      <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm bg-black/0">
        <span className={url ? "bg-black/35 rounded px-1.5 py-0.5" : "text-brand-dark/40"}>
          {label}
        </span>
      </span>
    </button>
  );
}

function Row({
  row,
  leftUrl,
  rightUrl,
  gapUrl,
  leftUploading,
  rightUploading,
  onSlotClick,
}: {
  row: (typeof ROWS)[number];
  leftUrl?: string;
  rightUrl?: string;
  gapUrl?: string;
  leftUploading?: boolean;
  rightUploading?: boolean;
  onSlotClick: (slotKey: string) => void;
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
              onClick={() => onSlotClick(row.leftKey)}
            />
            {row.showGap && (
              <div
                className="relative overflow-hidden bg-background"
                style={{ width: `${gapPct}%` }}
              >
                {gapUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gapUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </div>
            )}
            <Slot
              url={rightUrl}
              label={row.rightLabel}
              widthPercent={rightPct}
              uploading={rightUploading}
              onClick={() => onSlotClick(row.rightKey)}
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
  onSlotClick,
}: {
  uploadedUrls: Record<string, string>;
  uploadingSlots: Record<string, boolean>;
  onSlotClick: (slotKey: string) => void;
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
        Click any section below to add or change its photo.
      </p>

      <div className="space-y-6">
        {ROWS.map((row) => (
          <Row
            key={row.title}
            row={row}
            leftUrl={uploadedUrls[row.leftKey]}
            rightUrl={uploadedUrls[row.rightKey]}
            gapUrl={row.gapImageKey ? uploadedUrls[row.gapImageKey] : undefined}
            leftUploading={uploadingSlots[row.leftKey]}
            rightUploading={uploadingSlots[row.rightKey]}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}
