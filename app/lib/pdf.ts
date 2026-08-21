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

  page.drawText("NFC CD Keychain Artwork", {
    x: 40,
    y: pageHeight - 50,
    size: 16,
    font: boldFont,
  });

  let cursorY = pageHeight - 100;
  const sectionGap = 34;
  const labelGap = 18;

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

    // Section title
    page.drawText(section.title, {
      x: startX,
      y: cursorY,
      size: 12,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
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
  // Frame
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0.6, 0.6, 0.6),
  });

  // Slot label, centered under the box
  const labelSize = 9;
  const labelWidth = font.widthOfTextAtSize(spec.label, labelSize);
  page.drawText(spec.label, {
    x: x + (width - labelWidth) / 2,
    y: y - 12,
    size: labelSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  if (!url) return;

  try {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());

    const isPng = url.toLowerCase().includes(".png") || bytes[0] === 137;
    const image = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    page.drawImage(image, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  } catch (error) {
    console.error(`Failed to embed image for ${spec.label}`, error);
  }
}