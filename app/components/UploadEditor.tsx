"use client";

import { useRef, useState } from "react";
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
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{slot}</h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && (
        <p className="text-sm text-zinc-400 mt-2">Uploading...</p>
      )}

      <div className="mt-6 border inline-block">
        <CanvasEditor src={src} />
      </div>
    </div>
  );
}

function CanvasEditor({ src }: { src: string }) {
  const [image] = useImage(src);

  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  return (
    <Stage
      width={500}
      height={500}
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
              width={250}
              height={250}
              x={120}
              y={120}
            />

            <Transformer ref={transformerRef} />
          </>
        )}
      </Layer>
    </Stage>
  );
}
