"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";

export default function UploadEditor({
  slot,
  onUploaded,
}: {
  slot: string;
  onUploaded?: (url: string) => void;
}) {
  const [src, setSrc] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show an immediate local preview.
    setSrc(URL.createObjectURL(file));

    // Upload to Cloudinary so we have a persistent URL for the PDF/email.
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onUploaded?.(data.url);
    } catch (error) {
      console.error(`Upload failed for ${slot}:`, error);
    } finally {
      setUploading(false);
      // Allow re-selecting the same file again later.
      e.target.value = "";
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{slot}</h2>

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
        className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl disabled:opacity-50"
      >
        {uploading ? "Uploading..." : src ? "Change Image" : "Add Image"}
      </button>

      <div className="mt-6 border rounded-lg w-full max-w-[500px] overflow-hidden">
        <CanvasEditor src={src} />
      </div>
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
