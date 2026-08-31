import { SLOT_IDS, DEFAULT_ADJUSTMENT, type Adjustment, type SlotId } from "@/app/lib/pdf";
import OrderPreview from "@/app/components/OrderPreview";

// The shareable link a customer sends into LINE once they're done. It's a
// plain server-rendered https:// page (same origin/domain as the rest of
// the site, no blob: URL, no PDF response to render) — see the comments in
// app/customize/page.tsx's handleGeneratePDF for why blob: URLs and inline
// PDFs both break when opened from a different device/browser/in-app
// webview than the one that created them. This page sidesteps that
// entirely: any browser that can load a URL can render it.
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const images: Partial<Record<SlotId, string>> = {};
  const adjustments: Partial<Record<SlotId, Adjustment>> = {};

  for (const slotId of SLOT_IDS) {
    const url = firstValue(params[slotId]);
    if (url) images[slotId] = url;

    const scaleRaw = firstValue(params[`${slotId}_scale`]);
    const xRaw = firstValue(params[`${slotId}_x`]);
    const yRaw = firstValue(params[`${slotId}_y`]);
    if (scaleRaw !== undefined && xRaw !== undefined && yRaw !== undefined) {
      const scale = Number(scaleRaw);
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (Number.isFinite(scale) && Number.isFinite(x) && Number.isFinite(y)) {
        adjustments[slotId] = { scale, x, y };
      }
    }
  }

  const customerName = firstValue(params.customerName);
  const hasAnyPhoto = Object.keys(images).length > 0;

  // Re-derive the /api/generate-pdf query string from the same params
  // this page received, rather than hardcoding it, so it can't drift out
  // of sync with what that route actually reads.
  const pdfQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = firstValue(value);
    if (v !== undefined) pdfQuery.set(key, v);
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <img
            src="/pic/IMG_2488.png"
            alt="Gilly"
            width={1280}
            height={1280}
            className="h-10 w-auto object-contain"
          />
          <span className="text-[0.65rem] tracking-[0.3em] text-brand-dark/50 uppercase">
            NFC CD Keychain — Order
          </span>
        </div>

        {!hasAnyPhoto ? (
          <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-8 border border-brand/10 text-center text-foreground/60">
            This link doesn&apos;t have any photos attached — ask the
            customer to share the link again from their finished design.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-6 sm:p-8 border border-brand/10 mb-6">
              {customerName && (
                <p className="text-sm text-foreground/60 mb-6">
                  Order for <span className="font-medium text-foreground">{customerName}</span>
                </p>
              )}
              <OrderPreview
                images={images as Record<string, string>}
                adjustments={
                  Object.fromEntries(
                    SLOT_IDS.map((id) => [id, adjustments[id] ?? DEFAULT_ADJUSTMENT])
                  ) as Record<string, Adjustment>
                }
              />
            </div>

            <a
              href={`/api/generate-pdf?${pdfQuery.toString()}`}
              className="inline-block bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-brand/20 hover:shadow-brand/30"
            >
              Open print-ready PDF
            </a>
          </>
        )}
      </div>
    </main>
  );
}
