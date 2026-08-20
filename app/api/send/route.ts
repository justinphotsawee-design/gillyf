import { resend } from "@/lib/resend";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { images } = body as { images?: Record<string, string> };

    const imageListHtml = images
      ? Object.entries(images)
          .map(
            ([slot, url]) =>
              `<li>${slot}: <a href="${url}">${url}</a></li>`
          )
          .join("")
      : "";

    // Using Resend's shared test sender since it works without verifying
    // your own domain first. Once you verify a domain in Resend, switch
    // this to something like "orders@yourdomain.com".
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.ORDER_EMAIL!,
      subject: "New Keychain Order",
      html: `<h1>New Order</h1><ul>${imageListHtml}</ul>`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Send email failed:", error);
    return Response.json(
      { error: "Failed to send order email" },
      { status: 500 }
    );
  }
}
