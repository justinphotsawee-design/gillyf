import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadStreamMock = vi.fn();

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: (...args: unknown[]) => uploadStreamMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked module.
const { POST } = await import("./route");

function makeUploadRequest(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    uploadStreamMock.mockReset();
  });

  it("returns 400 when no file is attached", async () => {
    const res = await POST(makeUploadRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no file/i);
  });

  it("returns the Cloudinary secure_url on success", async () => {
    uploadStreamMock.mockImplementation((_opts, callback) => ({
      end: () => callback(null, { secure_url: "https://res.cloudinary.com/demo/image/upload/abc.jpg" }),
    }));

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://res.cloudinary.com/demo/image/upload/abc.jpg");
  });

  it("forces every upload to JPEG, regardless of the source format", async () => {
    uploadStreamMock.mockImplementation((_opts, callback) => ({
      end: () => callback(null, { secure_url: "https://res.cloudinary.com/demo/image/upload/converted.jpg" }),
    }));

    const heicFile = new File(["fake-heic-bytes"], "IMG_1234.HEIC", { type: "image/heic" });
    await POST(makeUploadRequest(heicFile));

    expect(uploadStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ format: "jpg" }),
      expect.any(Function)
    );
  });

  it("returns 500 (not a silent success) when Cloudinary rejects the upload", async () => {
    uploadStreamMock.mockImplementation((_opts, callback) => ({
      end: () => callback(new Error("Cloudinary quota exceeded"), null),
    }));

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/upload failed/i);
  });

  it("returns 500 when Cloudinary calls back with neither an error nor a result", async () => {
    uploadStreamMock.mockImplementation((_opts, callback) => ({
      end: () => callback(null, null),
    }));

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });
    const res = await POST(makeUploadRequest(file));
    expect(res.status).toBe(500);
  });
});
