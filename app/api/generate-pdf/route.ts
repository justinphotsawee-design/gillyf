import { createPDF, SLOT_IDS, type SlotId } from "@/app/lib/pdf";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { images } = body as { images?: Record<string, string> };

    const pdfBytes = await createPDF(images ?? {});

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
    for (const slotId of SLOT_IDS) {
      const url = searchParams.get(slotId);
      if (url) images[slotId] = url;
    }

    const pdfBytes = await createPDF(images);

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
