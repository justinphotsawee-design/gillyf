"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";

// Print slots top out around 5cm — anything past this is wasted upload
// time with no visible quality gain.
const MAX_DIMENSION = 1600;

async function shrinkForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    if (scale === 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, 0.85)
    );
    if (!blob) return file;

    return new File([blob], file.name, { type: blob.type || file.type });
  } catch {
    // Any failure here just falls back to uploading the original file.
    return file;
  }
}

export default function UploadEditor({
  slot,
  onUploaded,
  onUploadingChange,
}: {
  slot: string;
  onUploaded?: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [src, setSrc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show an immediate local preview.
    setSrc(URL.createObjectURL(file));
    setUploadError("");

    // Upload to Cloudinary so we have a persistent URL for the PDF/email.
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const uploadFile = await shrinkForUpload(file);

      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onUploaded?.(data.url);
    } catch (error) {
      console.error(`Upload failed for ${slot}:`, error);
      setUploadError(
        "Couldn't save this image to the server, so it won't appear in the PDF/email. Please try again."
      );
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      // Allow re-selecting the same file again later.
      e.target.value = "";
    }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
        {slot}
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-xl disabled:opacity-50 transition shadow-md shadow-brand/20"
      >
        {uploading ? "Uploading..." : src ? "Change Image" : "Add Image"}
      </button>

      {uploadError && (
        <p className="mt-2 text-sm text-red-600">{uploadError}</p>
      )}

      <div
        className={`mt-6 rounded-2xl w-full max-w-[500px] overflow-hidden bg-brand/5 ${
          src ? "border-2 border-brand/30" : "border-2 border-dashed border-brand/25"
        }`}
      >
        {!src && (
          <p className="text-center text-sm text-brand-dark/40 py-24">
            No image yet — click &ldquo;Add Image&rdquo; above
          </p>
        )}
        {src && <CanvasEditor src={src} />}
      </div>
      {src && (
        <p className="mt-2 text-xs text-foreground/40">
          Drag to reposition · use the corner handles to resize
        </p>
      )}
    </div>
  );
}

function CanvasEditor({ src }: { src: string }) {
  const [image] = useImage(src);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function updateSize() {
      if (!el) return;
      // Square canvas that fills the available width, capped at 500px
      // so it never overflows a narrow mobile screen.
      const width = el.offsetWidth;
      setSize(Math.max(200, Math.min(width, 500)));
    }

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Keep the same proportions as the original 500px design
  // (image at 24% offset, 50% of the stage size).
  const imgSize = size * 0.5;
  const imgOffset = size * 0.24;

  return (
    <div ref={containerRef} className="w-full">
      <Stage
        width={size}
        height={size}
        onClick={() => {
          if (imageRef.current) {
            transformerRef.current?.nodes([imageRef.current]);
          }
        }}
      >
        <Layer>
          {image && (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- this is Konva's canvas Image, not next/image */}
              <Image
                ref={imageRef}
                image={image}
                draggable
                width={imgSize}
                height={imgSize}
                x={imgOffset}
                y={imgOffset}
              />

              <Transformer ref={transformerRef} />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
