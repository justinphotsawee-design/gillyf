import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily creates the Resend client on first use instead of at module load
 * time. Constructing `new Resend()` without an API key throws immediately,
 * which previously broke `next build` (it evaluates route modules to
 * collect page data even when the key is only needed at request time).
 */
export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it in your environment variables (.env.local locally, or Vercel Project Settings > Environment Variables)."
    );
  }

  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }

  return client;
}
