import { DEFAULT_ADJUSTMENT, type Adjustment } from "./adjustment";

// Shared by customize/page.tsx (building the /order and /api/generate-pdf
// links once the customer finishes) and order/OrderClient.tsx (rebuilding
// them after an edit made directly on the /order page) — both need the
// exact same query shape the GET /api/generate-pdf route and /order's
// server component (app/order/page.tsx) parse back out, so it lives in
// one place instead of two copies that could drift apart.
export function buildOrderParams(
  images: Record<string, string | undefined>,
  adjustments: Record<string, Adjustment>,
  customerName?: string
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [slotId, url] of Object.entries(images)) {
    if (!url) continue;
    params.set(slotId, url);
    const adj = adjustments[slotId] ?? DEFAULT_ADJUSTMENT;
    params.set(`${slotId}_scale`, String(adj.scale));
    params.set(`${slotId}_x`, String(adj.x));
    params.set(`${slotId}_y`, String(adj.y));
  }
  if (customerName) params.set("customerName", customerName);
  return params;
}
