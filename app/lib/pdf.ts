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

// 1 cm in PDF points (72 pt / inch, 2.54 cm / inch)
const CM = 28.3465;

// Mirrors app/components/TemplatePreview.tsx exactly — same rows, same
// cm dimensions, same "no gap for Back/Packaging" layout — so the PDF a
// customer downloads matches the live preview on the site.
type SlotId =
  | "coverFront"
  | "coverBack"
  | "backOuter"
  | "backInner"
  | "packagingLeft"
  | "packagingRight";

interface RowSpec {
  title: string;
  leftId: SlotId;
  rightId: SlotId;
  leftLabel: string;
  rightLabel: string;
  leftWidthCm: number;
  rightWidthCm: number;
  heightCm: number;
  gapCm: number;
  showGap: boolean;
  gapImageId?: SlotId;
}

const ROWS: RowSpec[] = [
  {
    title: "COVER",
    leftId: "coverFront",
    rightId: "coverBack",
    leftLabel: "Front",
    rightLabel: "Back",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.5,
    showGap: true,
    // The center strip shows a sliver cropped from the middle of the Back
    // Inner photo instead of sitting empty.
    gapImageId: "backInner",
  },
  {
    title: "BACK",
    leftId: "backOuter",
    rightId: "backInner",
    leftLabel: "Outer",
    rightLabel: "Inner",
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
    leftLabel: "Text",
    rightLabel: "Image",
    leftWidthCm: 5,
    rightWidthCm: 4.3,
    heightCm: 3.8,
    gapCm: 1.5,
    showGap: false,
  },
];

// Brand palette, matching the web app's cream + deep-red theme.
const BRAND = rgb(0.659, 0.125, 0.184); // #a8202f
const CREAM = rgb(0.98, 0.953, 0.894); // #faf3e4 — same as --background
const MUTED = rgb(0.55, 0.47, 0.49); // brand-dark at ~45% opacity look
const DASH_BORDER = rgb(0.85, 0.45, 0.5);
const HAIRLINE = rgb(0.82, 0.82, 0.82);
const PLACEHOLDER_FILL = rgb(0.98, 0.96, 0.94);

export async function createPDF(
  images: Partial<Record<SlotId, string>>
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

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

  let cursorY = pageHeight - margin - 70;
  const rowGap = 44;
  const measureLabelSize = 7;
  const measureRowHeight = 12;
  const titleColWidth = 10;
  const colGap = 8;

  for (const row of ROWS) {
    const leftW = row.leftWidthCm * CM;
    const rightW = row.rightWidthCm * CM;
    const gapW = row.showGap ? row.gapCm * CM : 0;
    const rowHeight = row.heightCm * CM;
    const boxesWidth = leftW + gapW + rightW;

    const heightLabelText = `${row.heightCm}cm`;
    const heightLabelWidth = font.widthOfTextAtSize(
      heightLabelText,
      measureLabelSize
    );

    const rowContentWidth =
      titleColWidth + colGap + heightLabelWidth + colGap + boxesWidth;
    const rowStartX = (pageWidth - rowContentWidth) / 2;

    const heightLabelX = rowStartX + titleColWidth + colGap;
    const boxStartX = heightLabelX + heightLabelWidth + colGap;

    const boxTopY = cursorY - measureRowHeight;
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

    // Height label, horizontal, vertically centered on the row.
    page.drawText(heightLabelText, {
      x: heightLabelX,
      y: boxBottomY + rowHeight / 2 - 3,
      size: measureLabelSize,
      font,
      color: MUTED,
    });

    // Width labels above each box (and the gap, when there is one).
    drawCenteredLabel(
      page,
      font,
      `${row.leftWidthCm}cm`,
      boxStartX,
      leftW,
      boxTopY + 4,
      measureLabelSize,
      MUTED
    );
    if (row.showGap) {
      drawCenteredLabel(
        page,
        font,
        `${row.gapCm}cm`,
        boxStartX + leftW,
        gapW,
        boxTopY + 4,
        measureLabelSize,
        MUTED
      );
    }
    drawCenteredLabel(
      page,
      font,
      `${row.rightWidthCm}cm`,
      boxStartX + leftW + gapW,
      rightW,
      boxTopY + 4,
      measureLabelSize,
      MUTED
    );

    await drawSlot(
      pdf,
      page,
      font,
      images[row.leftId],
      row.leftLabel,
      boxStartX,
      boxBottomY,
      leftW,
      rowHeight
    );

    if (row.showGap) {
      const gapImage = row.gapImageId
        ? await tryEmbedImage(pdf, images[row.gapImageId])
        : null;

      if (gapImage) {
        drawImageCover(
          page,
          gapImage,
          boxStartX + leftW,
          boxBottomY,
          gapW,
          rowHeight
        );
      } else {
        page.drawRectangle({
          x: boxStartX + leftW,
          y: boxBottomY,
          width: gapW,
          height: rowHeight,
          color: CREAM,
        });
      }
    }

    await drawSlot(
      pdf,
      page,
      font,
      images[row.rightId],
      row.rightLabel,
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

function drawCenteredLabel(
  page: PDFPage,
  font: PDFFont,
  text: string,
  areaX: number,
  areaWidth: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: areaX + (areaWidth - textWidth) / 2,
    y,
    size,
    font,
    color,
  });
}

async function drawSlot(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  url: string | undefined,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const embedded = url ? await tryEmbedImage(pdf, url) : null;
  const labelText = label.toUpperCase();
  const labelSize = 7;

  if (embedded) {
    drawImageCover(page, embedded, x, y, width, height);

    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: 1,
      borderColor: DASH_BORDER,
      borderDashArray: [3, 2],
    });

    // Bottom label badge, matching the dark overlay chip in the preview.
    const badgeHeight = 13;
    page.drawRectangle({
      x,
      y,
      width,
      height: badgeHeight,
      color: rgb(0, 0, 0),
      opacity: 0.35,
    });
    const labelWidth = font.widthOfTextAtSize(labelText, labelSize);
    page.drawText(labelText, {
      x: x + (width - labelWidth) / 2,
      y: y + 4,
      size: labelSize,
      font,
      color: rgb(1, 1, 1),
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

    const labelWidth = font.widthOfTextAtSize(labelText, labelSize);
    page.drawText(labelText, {
      x: x + (width - labelWidth) / 2,
      y: y + 8,
      size: labelSize,
      font,
      color: MUTED,
    });
  }
}

// "Cover" fit (like CSS object-fit: cover) — scale up so the photo fills
// the whole area with no letterboxing, cropping the overflow via a clip
// region, same as the object-cover thumbnails in the preview.
function drawImageCover(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

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
