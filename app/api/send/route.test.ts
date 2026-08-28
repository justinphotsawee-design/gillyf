// @vitest-environment node
// This route calls into pdf.ts (fs.readFileSync-based font loading), which
// needs Node's real Uint8Array — see pdf.test.ts for why jsdom breaks it.
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("@/lib/resend", () => ({
  getResend: () => ({ emails: { send: sendMock } }),
}));

const { POST } = await import("./route");

function makeSendRequest(body: unknown) {
  return new Request("http://localhost/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/send", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("sends the shop notification and reports success", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const res = await POST(
      makeSendRequest({
        images: { coverFront: "https://res.cloudinary.com/demo/image/upload/a.jpg" },
        adjustments: {},
        customerName: "ต้นข้าว",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("includes a labeled link for every image slot in the email body", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await POST(
      makeSendRequest({
        images: { coverFront: "https://res.cloudinary.com/demo/image/upload/a.jpg" },
        customerName: "Test",
      })
    );

    const call = sendMock.mock.calls[0][0];
    expect(call.html).toContain("Cover Front");
    expect(call.html).toContain("https://res.cloudinary.com/demo/image/upload/a.jpg");
    expect(call.html).toContain("Test");
    expect(call.attachments[0].filename).toBe("keychain-order.pdf");
  });

  it("falls back to 'Unknown' in the email body when no customer name is given", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    await POST(makeSendRequest({ images: {} }));
    const call = sendMock.mock.calls[0][0];
    expect(call.html).toContain("Unknown");
  });

  it("does NOT report success when Resend's API rejects the send (Resend resolves instead of throwing)", async () => {
    // Regression guard for the explicit shopResult.error check in the
    // route — an unverified recipient, a bad from-address etc. all
    // surface as a resolved { error } rather than a thrown exception.
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "Recipient not verified", name: "validation_error" },
    });

    const res = await POST(makeSendRequest({ images: {}, customerName: "Test" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed/i);
  });

  it("handles a malformed/empty JSON body without crashing", async () => {
    sendMock.mockResolvedValue({ data: { id: "e1" }, error: null });
    const req = new Request("http://localhost/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
