import type { Adjustment } from "../components/TemplatePreview";

const STORAGE_KEY = "gilly:design";

export interface DesignProgress {
  uploadedUrls: Record<string, string>;
  adjustments: Record<string, Adjustment>;
}

// localStorage, not sessionStorage — deliberately. sessionStorage is
// scoped to a single top-level browsing context, and some in-app browsers
// (LINE, etc.) tear down and recreate that context on a full-page
// navigation — even to a same-origin URL — which wipes it. That's exactly
// what handleGeneratePDF's in-app-browser branch does (navigates the
// current tab to the PDF URL), so a customer who generates the PDF and
// then taps back would find every uploaded photo gone despite this
// module's whole job being to prevent that. localStorage is scoped to
// the origin instead of the tab, so it survives that kind of
// context-recreation the same way it survives an ordinary refresh.
//
// The tradeoff: unlike customer.ts's sessionStorage-based name gate (a
// deliberate per-visit-only choice), this now outlives the browser
// closing. On a shared device a second customer landing on /customize
// could otherwise inherit a stranger's photos — see clearDesignProgress,
// called from "/"'s submit handler, which is what actually prevents that
// (starting a fresh order is the one moment a *different* customer is
// distinguishable from the same one hitting back).
export function loadDesignProgress(): DesignProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full/disabled (e.g. private browsing) — losing the
    // resume-on-back convenience isn't worth surfacing an error over.
  }
}

export function clearDesignProgress(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
