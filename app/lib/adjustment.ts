// Shared by TemplatePreview.tsx (the editable grid used by both the
// customize page and, via its exported SlotGrid, the /order link — see
// order/OrderClient.tsx) and useImageAdjust.ts (the drag/pinch/wheel
// gesture logic that grid's Slot uses) — kept in one place so the two
// can't drift out of sync with each other. TemplatePreview.tsx re-exports
// these so existing `from "./TemplatePreview"` imports keep working.
export interface Adjustment {
  scale: number;
  x: number;
  y: number;
}

export const DEFAULT_ADJUSTMENT: Adjustment = { scale: 1, x: 0.5, y: 0.5 };
// scale is relative to the minimum "cover" size (1 = exactly fills the
// slot, matching the old fixed behavior). Below 1 shrinks the photo
// smaller than the slot, leaving the slot's background showing around it.
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 3;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
