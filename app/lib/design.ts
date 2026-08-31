import type { Adjustment } from "../components/TemplatePreview";

const STORAGE_KEY = "gilly:design";

export interface DesignProgress {
  uploadedUrls: Record<string, string>;
  adjustments: Record<string, Adjustment>;
}

// sessionStorage — same per-visit lifetime as customer.ts's name gate.
// This is what lets a customer navigate away (e.g. to an in-app browser's
// "open in Safari/Chrome" hop, or the PDF download in
// customize/page.tsx's handleGeneratePDF) and hit the browser's back
// button to return to /customize without every uploaded photo and
// position resetting, since that state otherwise only lives in that
// page's React state and is gone the moment it unmounts.
export function loadDesignProgress(): DesignProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesignProgress>;
    return {
      uploadedUrls: parsed.uploadedUrls ?? {},
      adjustments: parsed.adjustments ?? {},
    };
  } catch {
    return null;
  }
}

export function saveDesignProgress(progress: DesignProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full/disabled (e.g. private browsing) — losing the
    // resume-on-back convenience isn't worth surfacing an error over.
  }
}

export function clearDesignProgress(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
