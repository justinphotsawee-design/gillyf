import { getResend } from "@/lib/resend";
import { createPDF, SLOT_LABELS, type Adjustment, type SlotId } from "@/app/lib/pdf";

// Resend's shared test sender (onboarding@resend.dev) can only deliver to
// the email address on the Resend account itself — it can't reach an
// arbitrary customer's inbox. Sending the customer their PDF copy needs a
// verified sending domain (resend.com/domains); point this at an address
// on that domain once one is set up.
const CUSTOMER_FROM = process.env.CUSTOMER_EMAIL_FROM;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { images, adjustments, customerName, customerEmail } = body as {
      images?: Partial<Record<SlotId, string>>;
      adjustments?: Partial<Record<SlotId, Adjustment>>;
      customerName?: string;
      customerEmail?: string;
    };

    const imageListHtml = images
      ? Object.entries(images)
          .map(
            ([slot, url]) =>
              `<li>${SLOT_LABELS[slot as SlotId] ?? slot}: <a href="${url}">${url}</a></li>`
          )
          .join("")
      : "";

    const pdfBytes = await createPDF(images ?? {}, adjustments ?? {});
    const pdfBuffer = Buffer.from(pdfBytes);

    const resend = getResend();

    // The Resend SDK resolves with { data, error } instead of throwing on
    // API-level failures (e.g. an unverified recipient), so each send has
    // to be checked explicitly — an unchecked call here would report
    // "order sent" even when Resend rejected it.
    const shopResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.ORDER_EMAIL!,
      subject: "New Keychain Order",
      html: `<h1>New Order</h1><p>${customerName ?? "Unknown"} — ${
        customerEmail ?? "no email"
      }</p><ul>${imageListHtml}</ul>`,
      attachments: [
        { filename: "keychain-order.pdf", content: pdfBuffer },
      ],
    });
    if (shopResult.error) {
      throw new Error(
        `Shop notification email failed: ${shopResult.error.message}`
      );
    }

    let customerEmailSent = false;
    if (customerEmail && CUSTOMER_FROM) {
      const customerResult = await resend.emails.send({
        from: CUSTOMER_FROM,
        to: customerEmail,
        subject: "Your Gilly Gift & Craft design",
        html: `<p>Hi ${
          customerName ?? "there"
        },</p><p>Here's a copy of the keychain design you just saved. We'll be in touch about your order soon!</p><p>— Gilly Gift &amp; Craft</p>`,
        attachments: [
          { filename: "keychain-order.pdf", content: pdfBuffer },
        ],
      });
      if (customerResult.error) {
        // Don't fail the whole request over this — the shop notification
        // above already went out, so the order itself isn't lost.
        console.error(
          "Failed to email customer their PDF copy:",
          customerResult.error
        );
      } else {
        customerEmailSent = true;
      }
    }

    return Response.json({ success: true, customerEmailSent });
  } catch (error) {
    console.error("Send email failed:", error);
    return Response.json(
      { error: "Failed to send order email" },
      { status: 500 }
    );
  }
}
