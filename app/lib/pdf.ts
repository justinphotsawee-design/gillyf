import { PDFDocument } from "pdf-lib";

export async function createPDF(
  images: Record<string, string>
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  // A4 แนวตั้ง
  const page = pdf.addPage([595, 842]);

  page.drawText("NFC CD Keychain Artwork", {
    x: 40,
    y: 810,
    size: 18,
  });

  const positions = [
    { x: 30, y: 560 }, // Cover Front
    { x: 310, y: 560 }, // Cover Back

    { x: 30, y: 320 }, // Back Outer
    { x: 310, y: 320 }, // Back Inner

    { x: 30, y: 80 }, // Packaging Left
    { x: 310, y: 80 }, // Packaging Right
  ];

  const entries = Object.entries(images);

  for (let i = 0; i < Math.min(entries.length, 6); i++) {
    const [label, url] = entries[i];

    if (!url) continue;

    try {
      const response = await fetch(url);
      const bytes = new Uint8Array(await response.arrayBuffer());

      const isPng =
        url.toLowerCase().includes(".png") ||
        bytes[0] === 137;

      const image = isPng
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);

      const boxWidth = 250;
      const boxHeight = 160;

      const scale = Math.min(
        boxWidth / image.width,
        boxHeight / image.height
      );

      const width = image.width * scale;
      const height = image.height * scale;

      const x =
        positions[i].x + (boxWidth - width) / 2;

      const y =
        positions[i].y + (boxHeight - height) / 2;

      // ชื่อช่อง
      page.drawText(label, {
        x: positions[i].x,
        y: positions[i].y + boxHeight + 10,
        size: 10,
      });

      // กรอบ
      page.drawRectangle({
        x: positions[i].x,
        y: positions[i].y,
        width: boxWidth,
        height: boxHeight,
        borderWidth: 1,
      });

      // รูป
      page.drawImage(image, {
        x,
        y,
        width,
        height,
      });
    } catch (error) {
      console.error(
        `Failed to embed image for ${label}`,
        error
      );
    }
  }

  return pdf.save();
}