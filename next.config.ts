import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // app/lib/pdf.ts reads this font with fs.readFileSync at request time —
  // Next.js's build-time file tracer can't see through that dynamic path,
  // so without this the file gets left out of the deployed serverless
  // bundle (works locally, 500s on Vercel with ENOENT).
  outputFileTracingIncludes: {
    "/api/generate-pdf": ["./app/lib/fonts/*.ttf"],
    "/api/send": ["./app/lib/fonts/*.ttf"],
  },
};

export default nextConfig;
