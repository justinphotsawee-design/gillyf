import { createPDF, SLOT_IDS, type Adjustment, type SlotId } from "@/app/lib/pdf";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { images, adjustments, customerName } = body as {
      images?: Record<string, string>;
      adjustments?: Partial<Record<SlotId, Adjustment>>;
      customerName?: string;
    };

    const pdfBytes = await createPDF(images ?? {}, adjustments ?? {}, customerName);

    return new Response(pdfBytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="keychain-order.pdf"',
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return Response.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// In-app browsers (LINE, etc.) can't navigate to a blob: URL — it either
// renders blank (opened as a new tab) or triggers an "open external app?"
// prompt that goes nowhere (same tab). A plain, fetchable GET URL sidesteps
// both, since it's a normal https:// resource any webview can load
// directly. The image URLs are already-public Cloudinary URLs, so passing
// them in the query string carries no extra exposure.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const images: Partial<Record<SlotId, string>> = {};
    const adjustments: Partial<Record<SlotId, Adjustment>> = {};
    for (const slotId of SLOT_IDS) {
      const url = searchParams.get(slotId);
      if (url) images[slotId] = url;

      const scaleRaw = searchParams.get(`${slotId}_scale`);
      const xRaw = searchParams.get(`${slotId}_x`);
      const yRaw = searchParams.get(`${slotId}_y`);
      if (scaleRaw !== null && xRaw !== null && yRaw !== null) {
        const scale = Number(scaleRaw);
        const x = Number(xRaw);
        const y = Number(yRaw);
        if (Number.isFinite(scale) && Number.isFinite(x) && Number.isFinite(y)) {
          adjustments[slotId] = { scale, x, y };
        }
      }
    }

    const customerName = searchParams.get("customerName") ?? undefined;
    const pdfBytes = await createPDF(images, adjustments, customerName);

    return new Response(pdfBytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        // Inline (not attachment) so browsers/webviews that can render a
        // PDF show it directly instead of trying to hand it off elsewhere.
        "Content-Disposition": 'inline; filename="keychain-order.pdf"',
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return Response.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
