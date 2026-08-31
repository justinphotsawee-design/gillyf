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

    // Default to inline so an in-app-browser webview (LINE, etc.) that can
    // render a PDF at all shows it directly instead of trying (and often
    // failing) to hand a download off elsewhere. A real mobile browser tab
    // opts into `?download=1` instead (see handleGeneratePDF in
    // customize/page.tsx) — forwarding *that page* later is unreliable
    // (the browser's own inline PDF viewer can hand off a blob: reference
    // when the user shares/copies from within it, which is exactly the
    // "not found" / WebKitBlobResource error this route used to cause), so
    // a real download onto the device — then shared as an actual file
    // through LINE — sidesteps that class of bug entirely.
    const disposition = searchParams.get("download")
      ? "attachment"
      : "inline";

    return new Response(pdfBytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="keychain-order.pdf"`,
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
