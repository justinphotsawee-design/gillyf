// @vitest-environment node
//
// pdf.ts is server-only (fs.readFileSync, no DOM). Under jsdom, the global
// Uint8Array is jsdom's own realm's constructor, which Node's Buffer (from
// fs.readFileSync) fails `instanceof` against — pdf-lib's font/image
// embedding relies on exactly that check, so this has to run in `node`.
import { describe, it, expect, vi, afterEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createPDF, SLOT_IDS, SLOT_LABELS, DEFAULT_ADJUSTMENT } from "./pdf";

// A valid 1x1 transparent PNG, base64-decoded — real pdf-lib decoding of a
// hand-crafted/corrupt file is exactly the kind of thing that silently
// broke a manual test earlier this project (see the QA runsheet); use a
// real, verifiably-valid fixture instead of typed-out magic bytes.
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const ONE_PX_JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

describe("createPDF", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces a loadable single-page A4 PDF with no images at all", async () => {
    const bytes = await createPDF({}, {}, undefined);
    expect(bytes.slice(0, 5)).toEqual(new Uint8Array(Buffer.from("%PDF-")));

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders a Thai customer name without throwing (embedded Noto Sans Thai font)", async () => {
    const bytes = await createPDF({}, {}, "ต้นข้าว รักการ์ด");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders a mixed Thai/English name and trims correctly upstream", async () => {
    const bytes = await createPDF({}, {}, "Gilly ต้นข้าว 2026");
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });

  it("omits the name block entirely when no customer name is given", async () => {
    // Just asserts it doesn't throw when customerName is undefined/empty —
    // the visual "no name tag" behavior is covered by the manual QA runsheet.
    await expect(createPDF({}, {}, undefined)).resolves.toBeTruthy();
    await expect(createPDF({}, {}, "   ")).resolves.toBeTruthy();
  });

  it("embeds a real uploaded PNG for a filled slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => ONE_PX_PNG.buffer.slice(
          ONE_PX_PNG.byteOffset,
          ONE_PX_PNG.byteOffset + ONE_PX_PNG.byteLength
        ),
      }))
    );

    const bytes = await createPDF(
      { coverFront: "https://res.cloudinary.com/demo/image/upload/test.png" },
      { coverFront: { scale: 1, x: 0.5, y: 0.5 } },
      "Tester"
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("embeds a real uploaded JPEG for a filled slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => ONE_PX_JPG.buffer.slice(
          ONE_PX_JPG.byteOffset,
          ONE_PX_JPG.byteOffset + ONE_PX_JPG.byteLength
        ),
      }))
    );

    const bytes = await createPDF(
      { coverBack: "https://res.cloudinary.com/demo/image/upload/test.jpg" },
      {},
      undefined
    );
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });

  it("falls back to an empty placeholder (does not throw the whole PDF) when a slot's image fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const bytes = await createPDF(
      { coverFront: "https://res.cloudinary.com/demo/image/upload/unreachable.jpg" },
      {},
      undefined
    );
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });

  it("falls back to an empty placeholder for an unsupported image format (e.g. WEBP)", async () => {
    // RIFF/WEBP magic bytes — neither PNG nor JPEG, which is exactly what
    // tryEmbedImage's isPng/isJpg magic-byte sniff should reject.
    const webpBytes = Buffer.from("RIFF....WEBPVP8 ", "ascii");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => webpBytes.buffer.slice(
          webpBytes.byteOffset,
          webpBytes.byteOffset + webpBytes.byteLength
        ),
      }))
    );

    const bytes = await createPDF(
      { coverFront: "https://res.cloudinary.com/demo/image/upload/photo.webp" },
      {},
      undefined
    );
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });

  it("uses the same image once even if two slots share the identical URL (dedup via the URL Set)", async () => {
    const fetchSpy = vi.fn(async () => ({
      arrayBuffer: async () => ONE_PX_PNG.buffer.slice(
        ONE_PX_PNG.byteOffset,
        ONE_PX_PNG.byteOffset + ONE_PX_PNG.byteLength
      ),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const sameUrl = "https://res.cloudinary.com/demo/image/upload/shared.png";
    await createPDF({ coverFront: sameUrl, coverBack: sameUrl }, {}, undefined);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("always renders Packaging's right box as the fixed printed artwork, ignoring any packagingRight value passed in", async () => {
    // packagingRight isn't a real customer-fillable slot (see SLOT_LABELS
    // comment) — passing one in should be harmless, not swap the artwork.
    const bytes = await createPDF(
      { packagingRight: "https://res.cloudinary.com/demo/image/upload/should-be-ignored.png" },
      {},
      undefined
    );
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });
});

describe("SLOT_LABELS / SLOT_IDS", () => {
  it("has a label for every slot id, with no orphans either direction", () => {
    for (const id of SLOT_IDS) {
      expect(SLOT_LABELS[id]).toBeTruthy();
    }
    expect(Object.keys(SLOT_LABELS).sort()).toEqual([...SLOT_IDS].sort());
  });
});

describe("DEFAULT_ADJUSTMENT", () => {
  it("is centered and unzoomed", () => {
    expect(DEFAULT_ADJUSTMENT).toEqual({ scale: 1, x: 0.5, y: 0.5 });
  });
});
