// @vitest-environment node
// This route calls into pdf.ts (fs.readFileSync-based font loading), which
// needs Node's real Uint8Array — see pdf.test.ts for why jsdom breaks it.
import { describe, it, expect } from "vitest";
import { POST, GET } from "./route";

describe("POST /api/generate-pdf", () => {
  it("returns a downloadable PDF for an empty body", async () => {
    const req = new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(buf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("handles a totally malformed body without a 500", async () => {
    const req = new Request("http://localhost/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/generate-pdf (in-app-browser fallback path)", () => {
  it("returns an inline PDF built from query-string images and adjustments", async () => {
    const url =
      "http://localhost/api/generate-pdf?coverFront=https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fa.jpg" +
      "&coverFront_scale=1.5&coverFront_x=0.3&coverFront_y=0.7&customerName=Tester";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(buf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("ignores an incomplete adjustment triplet instead of throwing", async () => {
    // Only _scale present, no _x/_y — the route requires all three before
    // it treats the adjustment as usable.
    const url =
      "http://localhost/api/generate-pdf?coverFront=https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fa.jpg&coverFront_scale=1.5";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
  });

  it("ignores a non-numeric adjustment value instead of throwing", async () => {
    const url =
      "http://localhost/api/generate-pdf?coverFront=https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fa.jpg" +
      "&coverFront_scale=not-a-number&coverFront_x=0.5&coverFront_y=0.5";
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
  });

  it("returns a PDF with no query params at all (every slot empty)", async () => {
    const res = await GET(new Request("http://localhost/api/generate-pdf"));
    expect(res.status).toBe(200);
  });

  it("returns an attachment (downloadable) PDF when ?download=1 is set", async () => {
    const res = await GET(
      new Request("http://localhost/api/generate-pdf?download=1")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });
});
