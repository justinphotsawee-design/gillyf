import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload the raw bytes directly instead of a base64 data URL — base64
    // inflates the payload by ~33% and costs CPU time to encode, which adds
    // up on phone photos.
    const result = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "image" },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              reject(error ?? new Error("Upload returned no result"));
              return;
            }
            resolve(uploadResult);
          }
        );
        uploadStream.end(buffer);
      }
    );

    return Response.json({ url: result.secure_url });
  } catch (error) {
    console.error("Upload failed:", error);
    return Response.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
