import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  degrees,
  rgb,
  StandardFonts,
  clip,
  endPath,
  pushGraphicsState,
  popGraphicsState,
  rectangle as rectangleOp,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

// 1 cm in PDF points (72 pt / inch, 2.54 cm / inch)
const CM = 28.3465;

// pdf-lib's built-in fonts (Helvetica etc.) only cover WinAnsi/Latin —
// they throw on Thai characters, which the customer's name is likely to
// contain. This is a merged subset (Thai + Latin + digits, built from
// @fontsource/noto-sans-thai's split subsets via fonttools) so names in
// either script — or mixed — render instead of erroring out.
let thaiFontBytesCache: Uint8Array | null = null;
function loadThaiFontBytes(): Uint8Array {
  if (!thaiFontBytesCache) {
    thaiFontBytesCache = fs.readFileSync(
      path.join(process.cwd(), "app/lib/fonts/NotoSansThai-Regular.ttf")
    );
  }
  return thaiFontBytesCache;
}

// Mirrors app/components/TemplatePreview.tsx exactly — same rows, same
// cm dimensions, same "no gap for Back/Packaging" layout — so the PDF a
// customer downloads matches the live preview on the site.
export type SlotId =
  | "coverFront"
  | "coverGap"
  | "coverBack"
  | "backOuter"
  | "backInner"
  | "packagingLeft"
  | "packagingRight";

// Slot id -> human label, e.g. for the order-notification email. Kept in
// sync with ROWS below (same source the PDF layout itself uses).
export const SLOT_LABELS: Record<SlotId, string> = {
  coverFront: "Cover Front",
  coverGap: "Cover Gap",
  coverBack: "Cover Back",
  backOuter: "Back Outer",
  backInner: "Back Inner",
  packagingLeft: "Packaging Left",
  packagingRight: "Packaging Right",
};

export const SLOT_IDS = Object.keys(SLOT_LABELS) as SlotId[];

// How a photo is framed within its slot. (x, y) is the point of the image
// — as a 0..1 fraction from its top-left — that's favored when the "cover"
// crop has to cut something off; 0.5/0.5 is centered (the old fixed
// behavior). scale is relative to the minimum "cover" size (1 = exactly
// fills the slot); above 1 zooms in, below 1 shrinks the photo smaller
// than the slot. Mirrors the same knobs TemplatePreview.tsx exposes so
// the PDF matches what the customer positioned on-site.
export interface Adjustment {
  scale: number;
  x: number;
  y: number;
}

export const DEFAULT_ADJUSTMENT: Adjustment = { scale: 1, x: 0.5, y: 0.5 };
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

interface RowSpec {
  title: string;
  leftId: SlotId;
  rightId: SlotId;
  leftWidthCm: number;
  rightWidthCm: number;
  heightCm: number;
  gapCm: number;
  showGap: boolean;
  gapImageId?: SlotId;
}

const ROWS: RowSpec[] = [
  {
    title: "BACK",
    leftId: "coverFront",
    rightId: "coverBack",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.1,
    showGap: true,
    // The center strip is its own uploadable photo, not derived from
    // another slot.
    gapImageId: "coverGap",
  },
  {
    title: "COVER",
    leftId: "backOuter",
    rightId: "backInner",
    leftWidthCm: 4.1,
    rightWidthCm: 4.1,
    heightCm: 4.1,
    gapCm: 1,
    showGap: false,
  },
  {
    title: "PACKAGING",
    leftId: "packagingLeft",
    rightId: "packagingRight",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.5,
    showGap: false,
  },
];

// Brand palette, matching the web app's cream + deep-red theme.
const BRAND = rgb(0.659, 0.125, 0.184); // #a8202f
const MUTED = rgb(0.55, 0.47, 0.49); // brand-dark at ~45% opacity look
const DASH_BORDER = rgb(0.8, 0.8, 0.8); // light gray, not brand pink
const HAIRLINE = rgb(0.82, 0.82, 0.82);
const PLACEHOLDER_FILL = rgb(0.98, 0.96, 0.94);

// A little heart next to the customer's name — 24x24 viewBox, SVG
// convention (y grows downward from the drawSvgPath anchor).
const HEART_PATH =
  "M12 21s-6.7-4.35-9.5-8.5C.5 9.5 2 6 5.5 6c2 0 3.5 1.2 4.5 2.8C11 7.2 12.5 6 14.5 6 18 6 19.5 9.5 17.5 12.5 14.7 16.65 12 21 12 21z";

export async function createPDF(
  images: Partial<Record<SlotId, string>>,
  adjustments: Partial<Record<SlotId, Adjustment>> = {},
  customerName?: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  // Only Thai names need this (Helvetica can't encode them at all), but
  // it renders Latin fine too, so it's simplest to use it for the name
  // line unconditionally rather than picking a font per-name.
  const nameFont = await pdf.embedFont(loadThaiFontBytes());

  // Fetch every distinct image once, in parallel, up front — drawing the
  // rows below is otherwise a chain of sequential awaits (one Cloudinary
  // round trip per slot), which on a slow connection can push the
  // request well past the window in which mobile browsers still treat
  // the client's follow-up window.open() as tied to the user's tap.
  const urls = new Set(Object.values(images).filter((v): v is string => !!v));
  const embeddedByUrl = new Map(
    await Promise.all(
      Array.from(urls, async (url) => [url, await tryEmbedImage(pdf, url)] as const)
    )
  );

  // A4 portrait
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdf.addPage([pageWidth, pageHeight]);

  const margin = 32;

  // Outer frame — gives the sheet a printed, cut-to-size feel.
  page.drawRectangle({
    x: margin,
    y: margin,
    width: pageWidth - margin * 2,
    height: pageHeight - margin * 2,
    borderWidth: 1,
    borderColor: HAIRLINE,
  });

  const contentX = margin + 24;

  // Header — "Gilly  NFC CD KEYCHAIN", same single line as the on-site
  // preview (pdf-lib's built-in fonts can't render the script wordmark,
  // so this uses bold brand-colored text as the closest match).
  page.drawText("Gilly", {
    x: contentX,
    y: pageHeight - margin - 34,
    size: 20,
    font: boldFont,
    color: BRAND,
  });
  const gillyWidth = boldFont.widthOfTextAtSize("Gilly", 20);
  page.drawText("NFC CD KEYCHAIN", {
    x: contentX + gillyWidth + 10,
    y: pageHeight - margin - 30,
    size: 8,
    font,
    color: MUTED,
  });

  // Top-right corner, right-aligned under a little heart — kept off to
  // the side (rather than stacked under the header) so it doesn't push
  // the row layout below down, and reads like a small personalized tag.
  if (customerName?.trim()) {
    const name = customerName.trim();
    const rightEdge = pageWidth - contentX;
    const labelText = "MADE ESPECIALLY FOR";
    const labelSize = 7;
    const nameSize = 16;
    const labelY = pageHeight - margin - 22;
    const nameY = pageHeight - margin - 40;

    const labelWidth = nameFont.widthOfTextAtSize(labelText, labelSize);
    const heartSize = 7;
    const heartGap = 4;
    page.drawSvgPath(HEART_PATH, {
      x: rightEdge - labelWidth - heartGap - heartSize,
      y: labelY + heartSize - 1,
      scale: heartSize / 24,
      color: BRAND,
    });
    page.drawText(labelText, {
      x: rightEdge - labelWidth,
      y: labelY,
      size: labelSize,
      font: nameFont,
      color: MUTED,
    });

    const nameWidth = nameFont.widthOfTextAtSize(name, nameSize);
    page.drawText(name, {
      x: rightEdge - nameWidth,
      y: nameY,
      size: nameSize,
      font: nameFont,
      color: BRAND,
    });
  }

  let cursorY = pageHeight - margin - 70;
  const rowGap = 44;
  const titleColWidth = 10;
  const colGap = 8;

  for (const row of ROWS) {
    const leftW = row.leftWidthCm * CM;
    const rightW = row.rightWidthCm * CM;
    const gapW = row.showGap ? row.gapCm * CM : 0;
    const rowHeight = row.heightCm * CM;
    const boxesWidth = leftW + gapW + rightW;

    const rowContentWidth = titleColWidth + colGap + boxesWidth;
    const rowStartX = (pageWidth - rowContentWidth) / 2;

    const boxStartX = rowStartX + titleColWidth + colGap;

    const boxTopY = cursorY;
    const boxBottomY = boxTopY - rowHeight;

    // Section title, rotated to run vertically alongside the row.
    const titleWidth = boldFont.widthOfTextAtSize(row.title, 7);
    page.drawText(row.title, {
      x: rowStartX + 6,
      y: boxBottomY + rowHeight / 2 - titleWidth / 2,
      size: 7,
      font: boldFont,
      color: MUTED,
      rotate: degrees(90),
    });

    drawSlot(
      page,
      font,
      embeddedForSlot(images, embeddedByUrl, row.leftId),
      adjustments[row.leftId],
      boxStartX,
      boxBottomY,
      leftW,
      rowHeight
    );

    if (row.showGap) {
      drawSlot(
        page,
        font,
        row.gapImageId
          ? embeddedForSlot(images, embeddedByUrl, row.gapImageId)
          : null,
        row.gapImageId ? adjustments[row.gapImageId] : undefined,
        boxStartX + leftW,
        boxBottomY,
        gapW,
        rowHeight
      );
    }

    drawSlot(
      page,
      font,
      embeddedForSlot(images, embeddedByUrl, row.rightId),
      adjustments[row.rightId],
      boxStartX + leftW + gapW,
      boxBottomY,
      rightW,
      rowHeight
    );

    cursorY = boxBottomY - rowGap;
  }

  page.drawText("Gilly Gift & Craft — handmade to order", {
    x: contentX,
    y: margin + 14,
    size: 8,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });

  return pdf.save();
}

function embeddedForSlot(
  images: Partial<Record<SlotId, string>>,
  embeddedByUrl: Map<string, PDFImage | null>,
  slot: SlotId
): PDFImage | null {
  const url = images[slot];
  return url ? embeddedByUrl.get(url) ?? null : null;
}

function drawSlot(
  page: PDFPage,
  font: PDFFont,
  embedded: PDFImage | null,
  adjustment: Adjustment | undefined,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (embedded) {
    // A shrunk (scale < 1) photo doesn't fill the slot — paint the same
    // soft fill an empty slot uses underneath so the gap doesn't show
    // the bare page.
    page.drawRectangle({ x, y, width, height, color: PLACEHOLDER_FILL });
    drawImageCover(page, embedded, adjustment ?? DEFAULT_ADJUSTMENT, x, y, width, height);

    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: 1,
      borderColor: DASH_BORDER,
      borderDashArray: [3, 2],
    });
  } else {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: PLACEHOLDER_FILL,
      borderWidth: 1,
      borderColor: DASH_BORDER,
      borderDashArray: [3, 2],
    });

    page.drawText("+", {
      x: x + width / 2 - 4,
      y: y + height / 2 - 6,
      size: 16,
      font,
      color: DASH_BORDER,
    });
  }
}

// "Cover" fit (like CSS object-fit: cover) at adjustment.scale == 1 — the
// photo fills the whole area with no letterboxing, cropping the overflow
// via a clip region, same as the object-cover thumbnails in the preview.
// `adjustment` re-centers that crop around (x, y) — a 0..1 fraction from
// the image's top-left — instead of always centering, and scales past
// (zoom in) or below (shrink, leaving the slot's fill visible around it)
// that minimum cover size.
function drawImageCover(
  page: PDFPage,
  image: PDFImage,
  adjustment: Adjustment,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const coverScale = Math.max(width / image.width, height / image.height);
  const userScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, adjustment.scale));
  const scale = coverScale * userScale;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  // PDF's y-axis runs bottom-up, so a "from the top" y fraction (matching
  // the CSS side) has to flip: y=0 pins the image's top edge to the box's
  // top edge, y=1 pins its bottom edge to the box's bottom.
  const drawX = x - adjustment.x * (drawWidth - width);
  const drawY = y + (height - drawHeight) * (1 - adjustment.y);

  page.pushOperators(
    pushGraphicsState(),
    rectangleOp(x, y, width, height),
    clip(),
    endPath()
  );
  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
  });
  page.pushOperators(popGraphicsState());
}

async function tryEmbedImage(
  pdf: PDFDocument,
  url: string | undefined
): Promise<PDFImage | null> {
  if (!url) return null;

  let bytes: Uint8Array;
  try {
    const response = await fetch(url);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error(`Failed to fetch image from ${url}`, error);
    return null;
  }

  // Detect the real format from the file's magic bytes rather than the
  // URL — trustworthy even if a URL has no/misleading extension.
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;

  // Uploads are forced to JPEG server-side (see api/upload/route.ts), so
  // this is mainly a safety net for older uploads. pdf-lib only supports
  // PNG/JPEG, so anything else (HEIC, WEBP, ...) can't be embedded — the
  // slot just falls back to the empty placeholder.
  try {
    if (isPng) return await pdf.embedPng(bytes);
    if (isJpg) return await pdf.embedJpg(bytes);
    console.error(`Unsupported image format for ${url} (not PNG or JPEG)`);
    return null;
  } catch (error) {
    console.error(`Failed to embed image from ${url}`, error);
    return null;
  }
}
