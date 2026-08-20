import { PDFDocument } from "pdf-lib";

export async function createPDF(
  imageUrls: string[]
) {
  const pdf =
    await PDFDocument.create();

  const page =
    pdf.addPage([595, 842]);

  page.drawText(
    "NFC Keychain Order"
  );

  return await pdf.save();
}