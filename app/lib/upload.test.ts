import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadImage } from "./upload";

function makeFile(name = "photo.png", type = "image/png") {
  return new File(["fake-bytes"], name, { type });
}

describe("uploadImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the file to /api/upload and resolves with the returned URL", async () => {
    const fetchMock: (url: string, opts?: RequestInit) => Promise<unknown> = vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/x.jpg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const url = await uploadImage(makeFile());

    expect(url).toBe("https://res.cloudinary.com/demo/image/upload/x.jpg");
    const [calledUrl, opts] = vi.mocked(fetchMock).mock.calls[0];
    expect(calledUrl).toBe("/api/upload");
    expect(opts?.method).toBe("POST");
    expect(opts?.body).toBeInstanceOf(FormData);
  });

  it("throws when the server responds with a non-ok status, instead of silently swallowing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "Upload failed" }) }))
    );

    await expect(uploadImage(makeFile())).rejects.toThrow("Upload failed");
  });

  it("still resolves when the browser can't shrink the image (no canvas/createImageBitmap support) — falls back to the original file", async () => {
    // jsdom has neither createImageBitmap nor a real 2D canvas context, so
    // this exercises shrinkForUpload's catch-all fallback for real, the
    // same path a browser without ImageBitmap support would take.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/x.jpg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImage(makeFile("big.jpg", "image/jpeg"))).resolves.toBe(
      "https://res.cloudinary.com/demo/image/upload/x.jpg"
    );
  });
});
