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

function Slot({ url, label, widthPercent }: { url?: string; label: string; widthPercent: number }) {
  return (
    <div
      className="relative border border-dashed border-brand/30 bg-brand/5 flex items-center justify-center overflow-hidden"
      style={{ width: `${widthPercent}%` }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-brand/30 text-2xl leading-none">+</span>
      )}
      <span className="absolute bottom-1.5 inset-x-0 text-center text-[0.6rem] tracking-widest uppercase text-white/90 drop-shadow-sm bg-black/0">
        <span className={url ? "bg-black/35 rounded px-1.5 py-0.5" : "text-brand-dark/40"}>
          {label}
        </span>
      </span>
    </div>
  );
}

function Row({
  row,
  leftUrl,
  rightUrl,
}: {
  row: (typeof ROWS)[number];
  leftUrl?: string;
  rightUrl?: string;
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
        <div className="shrink-0 flex items-center justify-center text-[0.6rem] text-brand-dark/45 text-center min-w-[2.2rem]">
          {row.heightCm}cm
        </div>

        <div className="flex-1">
          <div className="flex mb-1 text-[0.6rem] text-brand-dark/45">
            <div style={{ width: `${leftPct}%` }} className="text-center">
              {row.leftWidthCm}cm
            </div>
            {row.showGap && (
              <div style={{ width: `${gapPct}%` }} className="text-center">
                {row.gapCm}cm
              </div>
            )}
            <div style={{ width: `${rightPct}%` }} className="text-center">
              {row.rightWidthCm}cm
            </div>
          </div>
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ aspectRatio: `${totalWidthCm} / ${row.heightCm}` }}
          >
            <Slot url={leftUrl} label={row.leftLabel} widthPercent={leftPct} />
            {row.showGap && (
              <div style={{ width: `${gapPct}%` }} className="bg-background" />
            )}
            <Slot
              url={rightUrl}
              label={row.rightLabel}
              widthPercent={rightPct}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatePreview({
  uploadedUrls,
}: {
  uploadedUrls: Record<string, string>;
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

      <div className="space-y-6">
        {ROWS.map((row) => (
          <Row
            key={row.title}
            row={row}
            leftUrl={uploadedUrls[row.leftKey]}
            rightUrl={uploadedUrls[row.rightKey]}
          />
        ))}
      </div>
    </div>
  );
}
