import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

// 1 cm in PDF points (72 pt / inch, 2.54 cm / inch)
const CM = 28.3465;

// Each slot's real-world size, taken from the NFC CD Keychain
// template (cover 5cm / 4.3cm wide x 3.8cm tall, back outer/inner 4.1cm
// square, packaging matched to the cover width).
type SlotId =
  | "coverFront"
  | "coverBack"
  | "backOuter"
  | "backInner"
  | "packagingLeft"
  | "packagingRight";

interface SlotSpec {
  label: string;
  widthCm: number;
  heightCm: number;
}

const SLOTS: Record<SlotId, SlotSpec> = {
  coverFront: { label: "Front", widthCm: 5, heightCm: 3.8 },
  coverBack: { label: "Back", widthCm: 4.3, heightCm: 3.8 },
  backOuter: { label: "Outer", widthCm: 4.1, heightCm: 4.1 },
  backInner: { label: "Inner", widthCm: 4.1, heightCm: 4.1 },
  packagingLeft: { label: "Text", widthCm: 5, heightCm: 3.8 },
  packagingRight: { label: "Image", widthCm: 4.3, heightCm: 3.8 },
};

// gap between the two boxes in each row
const GAP_CM: Record<"cover" | "back" | "packaging", number> = {
  cover: 1.5,
  back: 1,
  packaging: 1.5,
};

const SECTIONS: {
  title: string;
  gapKey: "cover" | "back" | "packaging";
  left: SlotId;
  right: SlotId;
}[] = [
  { title: "COVER", gapKey: "cover", left: "coverFront", right: "coverBack" },
  { title: "BACK", gapKey: "back", left: "backOuter", right: "backInner" },
  {
    title: "PACKAGING",
    gapKey: "packaging",
    left: "packagingLeft",
    right: "packagingRight",
  },
];

// Brand palette, matching the web app's cream + deep-red theme.
const BRAND = rgb(0.659, 0.125, 0.184); // #a8202f
const INK = rgb(0.165, 0.102, 0.082); // #2a1a15
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

  // Brand header
  page.drawText("GILLY GIFT & CRAFT", {
    x: contentX,
    y: pageHeight - margin - 30,
    size: 10,
    font: boldFont,
    color: BRAND,
  });
  page.drawText("NFC CD Keychain — Print Artwork", {
    x: contentX,
    y: pageHeight - margin - 48,
    size: 18,
    font: boldFont,
    color: INK,
  });
  page.drawLine({
    start: { x: contentX, y: pageHeight - margin - 62 },
    end: { x: pageWidth - margin - 24, y: pageHeight - margin - 62 },
    thickness: 1,
    color: HAIRLINE,
  });

  let cursorY = pageHeight - margin - 100;
  const sectionGap = 40;
  const labelGap = 20;

  for (const section of SECTIONS) {
    const leftSpec = SLOTS[section.left];
    const rightSpec = SLOTS[section.right];
    const gapPt = GAP_CM[section.gapKey] * CM;

    const leftW = leftSpec.widthCm * CM;
    const leftH = leftSpec.heightCm * CM;
    const rightW = rightSpec.widthCm * CM;
    const rightH = rightSpec.heightCm * CM;

    const rowWidth = leftW + gapPt + rightW;
    const rowHeight = Math.max(leftH, rightH);
    const startX = (pageWidth - rowWidth) / 2;

    // Section title, small-caps style with a short brand-colored rule.
    page.drawText(section.title, {
      x: startX,
      y: cursorY,
      size: 11,
      font: boldFont,
      color: INK,
    });
    page.drawLine({
      start: { x: startX, y: cursorY - 6 },
      end: { x: startX + 28, y: cursorY - 6 },
      thickness: 2,
      color: BRAND,
    });

    const boxTopY = cursorY - labelGap;

    const leftX = startX;
    const rightX = startX + leftW + gapPt;
    const leftY = boxTopY - leftH;
    const rightY = boxTopY - rightH;

    await drawSlot(
      pdf,
      page,
      font,
      images[section.left],
      leftSpec,
      leftX,
      leftY,
      leftW,
      leftH
    );
    await drawSlot(
      pdf,
      page,
      font,
      images[section.right],
      rightSpec,
      rightX,
      rightY,
      rightW,
      rightH
    );

    cursorY = boxTopY - rowHeight - sectionGap;
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

async function drawSlot(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  url: string | undefined,
  spec: SlotSpec,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const embedded = url ? await tryEmbedImage(pdf, url) : null;

  if (embedded) {
    const scale = Math.min(width / embedded.width, height / embedded.height);
    const drawWidth = embedded.width * scale;
    const drawHeight = embedded.height * scale;

    // Crisp corner ticks instead of a full box now that there's a photo
    // filling the frame — keeps the sheet feeling like a cut guide rather
    // than a form.
    drawCornerTicks(page, x, y, width, height);

    page.drawImage(embedded, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  } else {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: PLACEHOLDER_FILL,
      borderWidth: 1,
      borderColor: HAIRLINE,
      borderDashArray: [4, 3],
    });
  }

  // Slot label, centered under the box
  const labelSize = 9;
  const labelWidth = font.widthOfTextAtSize(spec.label, labelSize);
  page.drawText(spec.label, {
    x: x + (width - labelWidth) / 2,
    y: y - 12,
    size: labelSize,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

const TICK_LENGTH = 10;

function drawCornerTicks(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const corners: [number, number, number, number][] = [
    // each: [cornerX, cornerY, dirX, dirY]
    [x, y + height, 1, -1], // top-left
    [x + width, y + height, -1, -1], // top-right
    [x, y, 1, 1], // bottom-left
    [x + width, y, -1, 1], // bottom-right
  ];

  for (const [cx, cy, dx, dy] of corners) {
    page.drawLine({
      start: { x: cx, y: cy },
      end: { x: cx + dx * TICK_LENGTH, y: cy },
      thickness: 1,
      color: HAIRLINE,
    });
    page.drawLine({
      start: { x: cx, y: cy },
      end: { x: cx, y: cy + dy * TICK_LENGTH },
      thickness: 1,
      color: HAIRLINE,
    });
  }
}

async function tryEmbedImage(pdf: PDFDocument, url: string) {
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