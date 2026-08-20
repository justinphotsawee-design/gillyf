import { createPDF } from "@/app/lib/pdf";

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
