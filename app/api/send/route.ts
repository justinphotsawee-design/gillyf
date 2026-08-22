import { getResend } from "@/lib/resend";
import { createPDF, SLOT_LABELS, type Adjustment, type SlotId } from "@/app/lib/pdf";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { images, adjustments, customerName } = body as {
      images?: Partial<Record<SlotId, string>>;
      adjustments?: Partial<Record<SlotId, Adjustment>>;
      customerName?: string;
    };

    const imageListHtml = images
      ? Object.entries(images)
          .map(
            ([slot, url]) =>
              `<li>${SLOT_LABELS[slot as SlotId] ?? slot}: <a href="${url}">${url}</a></li>`
          )
          .join("")
      : "";

    const pdfBytes = await createPDF(images ?? {}, adjustments ?? {}, customerName);
    const pdfBuffer = Buffer.from(pdfBytes);

    const resend = getResend();

    // The Resend SDK resolves with { data, error } instead of throwing on
    // API-level failures (e.g. an unverified recipient), so this has to be
    // checked explicitly — an unchecked call here would report "order
    // sent" even when Resend rejected it.
    const shopResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.ORDER_EMAIL!,
      subject: "New Keychain Order",
      html: `<h1>New Order</h1><p>${customerName ?? "Unknown"}</p><ul>${imageListHtml}</ul>`,
      attachments: [
        { filename: "keychain-order.pdf", content: pdfBuffer },
      ],
    });
    if (shopResult.error) {
      throw new Error(
        `Shop notification email failed: ${shopResult.error.message}`
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Send email failed:", error);
    return Response.json(
      { error: "Failed to send order email" },
      { status: 500 }
    );
  }
}
