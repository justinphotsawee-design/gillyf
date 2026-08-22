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

export async function uploadImage(file: File): Promise<string> {
  const uploadFile = await shrinkForUpload(file);

  const formData = new FormData();
  formData.append("file", uploadFile);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");

  const data = await res.json();
  return data.url as string;
}
