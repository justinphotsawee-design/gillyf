import { PDFDocument } from "pdf-lib";

/**
 * Builds a simple order-summary PDF containing the uploaded design images.
 * `images` maps a slot label (e.g. "Cover Front") to its uploaded image URL.
 */
export async function createPDF(
  images: Record<string, string>
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();

  page.drawText("NFC Keychain Order", {
    x: 50,
    y: height - 50,
    size: 20,
  });

  let cursorY = height - 90;

  for (const [label, url] of Object.entries(images)) {
    if (!url) continue;

    try {
      const res = await fetch(url);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const isPng = url.toLowerCase().includes(".png");
      const image = isPng
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);

      const maxWidth = 200;
      const scale = maxWidth / image.width;
      const imgHeight = image.height * scale;

      if (cursorY - imgHeight < 40) {
        cursorY = height - 40;
      }

      page.drawText(label, { x: 50, y: cursorY - 15, size: 12 });
      page.drawImage(image, {
        x: 50,
        y: cursorY - 20 - imgHeight,
        width: maxWidth,
        height: imgHeight,
      });

      cursorY -= imgHeight + 50;
    } catch (error) {
      console.error(`Failed to embed image for ${label}:`, error);
    }
  }

  return pdf.save();
}
