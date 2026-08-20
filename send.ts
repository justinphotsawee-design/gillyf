import { resend } from "@/lib/resend";

export async function POST() {
  await resend.emails.send({
    from:
      "orders@yourshop.com",

    to:
      process.env.ORDER_EMAIL!,

    subject:
      "New Keychain Order",

    html:
      "<h1>New Order</h1>",
  });

  return Response.json({
    success: true,
  });
}