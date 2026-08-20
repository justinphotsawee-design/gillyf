"use client";

import { useRef, useState } from "react";
import { Stage, Layer, Image, Transformer } from "react-konva";
import useImage from "use-image";

export default function UploadEditor({
  slot,
}: {
  slot: string;
}) {
  const [src, setSrc] = useState("");

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {slot}
      </h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (!file) return;

          setSrc(URL.createObjectURL(file));
        }}
      />

      <div className="mt-6 border inline-block">
        <CanvasEditor src={src} />
      </div>
    </div>
  );
}

function CanvasEditor({ src }: { src: string }) {
  const [image] = useImage(src);

  const imageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  return (
    <Stage
      width={500}
      height={500}
      onClick={() => {
        transformerRef.current?.nodes([
          imageRef.current,
        ]);
      }}
    >
      <Layer>
        {image && (
          <>
            <Image
              ref={imageRef}
              image={image}
              draggable
              width={250}
              height={250}
              x={120}
              y={120}
            />

            <Transformer
              ref={transformerRef}
            />
          </>
        )}
      </Layer>
    </Stage>
  );
}