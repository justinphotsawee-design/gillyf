"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TemplatePreview, {
  DEFAULT_ADJUSTMENT,
  type Adjustment,
} from "../components/TemplatePreview";
import { uploadImage } from "../lib/upload";
import { loadCustomerInfo, type CustomerInfo } from "../lib/customer";
import { loadDesignProgress, saveDesignProgress } from "../lib/design";
import { isInAppBrowser, isMobileBrowser } from "../lib/browser";

const slots = [
  { id: "coverFront", label: "Cover Front" },
  { id: "coverGap", label: "Cover Gap" },
  { id: "coverBack", label: "Cover Back" },
  { id: "backOuter", label: "Back Outer" },
  { id: "backInner", label: "Back Inner" },
  { id: "packagingLeft", label: "Packaging Left" },
  // Packaging Right is fixed printed artwork, not a customer upload — see
  // TemplatePreview's rightFixedUrl / pdf.ts's packagingRightImage.
];

// Same query shape buildOrderParams()/the GET /api/generate-pdf route
// use — parsed back out client-side so a customer returning to this exact
// URL (see handleGeneratePDF's use of history.replaceState) recovers
// their design straight from the address bar. This is the recovery path
// that actually survives an in-app browser's same-tab navigation to the
// PDF and back: unlike localStorage/sessionStorage, which some in-app
// webviews (LINE, etc.) inconsistently reset when they tear down and
// recreate their browsing context on navigation — the exact
// "saves on some devices, not others" symptom this was built to fix —
// the URL itself is part of the browser's own history/navigation
// mechanism, not a storage API, so nothing app-specific can wipe it.
function parseDesignFromSearch(
  search: string
): { uploadedUrls: Record<string, string>; adjustments: Record<string, Adjustment> } | null {
  const params = new URLSearchParams(search);
  const uploadedUrls: Record<string, string> = {};
  const adjustments: Record<string, Adjustment> = {};
  for (const { id } of slots) {
    const url = params.get(id);
    if (url) uploadedUrls[id] = url;

    const scaleRaw = params.get(`${id}_scale`);
    const xRaw = params.get(`${id}_x`);
    const yRaw = params.get(`${id}_y`);
    if (scaleRaw !== null && xRaw !== null && yRaw !== null) {
      const scale = Number(scaleRaw);
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (Number.isFinite(scale) && Number.isFinite(x) && Number.isFinite(y)) {
        adjustments[id] = { scale, x, y };
      }
    }
  }
  return Object.keys(uploadedUrls).length > 0 ? { uploadedUrls, adjustments } : null;
}

export default function Customize() {
  const router = useRouter();
  // sessionStorage doesn't exist during SSR, so this has to start as null
  // (matching the server-rendered output) and get filled in after mount —
  // reading it eagerly here would render different content on the server
  // vs. the client's first pass and trigger a hydration mismatch.
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [checkedCustomer, setCheckedCustomer] = useState(false);
  const [inAppBrowser] = useState(() => isInAppBrowser());

  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>(
    {}
  );
  const [uploadingSlots, setUploadingSlots] = useState<
    Record<string, boolean>
  >({});
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>(
    {}
  );
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<string | null>(null);
  // Guards the save effect below from firing (and overwriting the saved
  // progress with the empty initial state) before the load below has had
  // a chance to run — see that effect's comment.
  const hydratedRef = useRef(false);

  // This page requires the name/email gate on "/" to have been completed
  // first — bounce back there instead of showing a broken form if someone
  // lands here directly (bookmark, back button after clearing session, …).
  useEffect(() => {
    const info = loadCustomerInfo();
    // Reading sessionStorage (a browser-only API with no server
    // equivalent) is exactly the "sync from an external system" case the
    // set-state-in-effect rule carves out — it can't run any earlier than
    // this without reintroducing the SSR/client mismatch above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomer(info);
    setCheckedCustomer(true);
    if (!info) {
      router.replace("/");
      return;
    }
    // Restore any photos/positions from a previous visit — e.g. the
    // customer navigated away to view/download the generated PDF and hit
    // the browser's back button to return here. Without this, that state
    // (which only ever lived in this component's React state) is just
    // gone, and they'd have to re-upload everything.
    //
    // Try the URL first (see parseDesignFromSearch/handleGeneratePDF —
    // it's the reliable path), then fall back to localStorage for a
    // plain refresh, which never touches the URL at all.
    const fromUrl = parseDesignFromSearch(window.location.search);
    if (fromUrl) {
      setUploadedUrls(fromUrl.uploadedUrls);
      setAdjustments(fromUrl.adjustments);
      // Clean the (potentially long) query string back off once it's
      // been read, so it doesn't linger in the address bar/history.
      window.history.replaceState(null, "", "/customize");
    } else {
      const saved = loadDesignProgress();
      if (saved) {
        setUploadedUrls(saved.uploadedUrls);
        setAdjustments(saved.adjustments);
      }
    }
    hydratedRef.current = true;
    // Deliberately run once on mount only — this is a one-time "check
    // sessionStorage before the first paint of real content" gate, not
    // something that should re-run if `router` ever changes identity
    // (Next's useRouter() is normally stable, but nothing here needs it
    // to be: `router.replace` is only ever called with a fixed path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change so the restore above always has the latest
  // state to work with, not just whatever existed at the last explicit
  // save point.
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveDesignProgress({ uploadedUrls, adjustments });
  }, [uploadedUrls, adjustments]);

  const anyUploading = Object.values(uploadingSlots).some(Boolean);

  function handleSlotClick(slotId: string) {
    pendingSlotRef.current = slotId;
    fileInputRef.current?.click();
  }

  function handleAdjustChange(slotId: string, next: Adjustment) {
    setAdjustments((prev) => ({ ...prev, [slotId]: next }));
  }

  function handleRemoveSlot(slotId: string) {
    setUploadedUrls((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setAdjustments((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slotId = pendingSlotRef.current;

    // Reset immediately (not in `finally` after the upload) so the input
    // is ready to fire another change event right away. Otherwise picking
    // a different slot while a prior upload is still in flight and
    // choosing the same file path leaves the input's value unchanged —
    // the browser sees no change and silently skips the event, and it
    // looks like the click did nothing until the first upload finishes.
    e.target.value = "";

    if (!file || !slotId) return;

    // Show an immediate local preview while the real upload happens.
    setUploadedUrls((prev) => ({ ...prev, [slotId]: URL.createObjectURL(file) }));
    setUploadingSlots((prev) => ({ ...prev, [slotId]: true }));
    // A new photo starts centered and unzoomed — carrying over the
    // previous photo's crop would rarely still make sense.
    setAdjustments((prev) => ({ ...prev, [slotId]: DEFAULT_ADJUSTMENT }));
    pendingSlotRef.current = null;

    try {
      const url = await uploadImage(file);
      setUploadedUrls((prev) => ({ ...prev, [slotId]: url }));
    } catch (error) {
      console.error(`Upload failed for ${slotId}:`, error);
      setStatusMessage(
        "Couldn't save that photo to the server, so it won't appear in the PDF/email. Please try again."
      );
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotId]: false }));
    }
  }

  // Fire the shop-notification email (previously the separate "Save
  // Design" button) — now bundled into the single Generate PDF action
  // instead of requiring a second click.
  async function notifyShop(): Promise<boolean> {
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: uploadedUrls,
          adjustments,
          customerName: customer?.name,
        }),
      });
      return res.ok;
    } catch (error) {
      console.error("Failed to notify shop:", error);
      return false;
    }
  }

  // Shared by buildPdfUrl and buildOrderUrl — both routes read the exact
  // same query shape (see /api/generate-pdf's GET handler and
  // app/order/page.tsx), just rendering it differently.
  function buildOrderParams(): URLSearchParams {
    const params = new URLSearchParams();
    for (const [slotId, url] of Object.entries(uploadedUrls)) {
      if (!url) continue;
      params.set(slotId, url);
      const adj = adjustments[slotId] ?? DEFAULT_ADJUSTMENT;
      params.set(`${slotId}_scale`, String(adj.scale));
      params.set(`${slotId}_x`, String(adj.x));
      params.set(`${slotId}_y`, String(adj.y));
    }
    if (customer?.name) params.set("customerName", customer.name);
    return params;
  }

  // Builds the same query string the GET /api/generate-pdf route reads,
  // so navigating straight to that URL renders without ever creating a
  // blob: URL — see handleGeneratePDF for why that matters on mobile.
  // `forceDownload` adds `?download=1`, which the route reads to send
  // `Content-Disposition: attachment` instead of `inline` — see
  // handleGeneratePDF's isMobile branch for why a real browser tab wants
  // that (an in-app-browser webview does not, so it's opt-in).
  function buildPdfUrl(forceDownload = false): string {
    const params = buildOrderParams();
    if (forceDownload) params.set("download", "1");
    return `/api/generate-pdf?${params.toString()}`;
  }

  // Bakes the current design into /customize's own URL right before a
  // same-tab navigation away from it (see the two call sites in
  // handleGeneratePDF below). The browser's back button always returns to
  // the exact URL a history entry held — including its query string —
  // regardless of what happens to that page's storage in between. So a
  // customer who taps back after this lands back on
  // /customize?coverFront=...&... , and parseDesignFromSearch/the mount
  // effect above restores straight from that, without depending on
  // localStorage/sessionStorage surviving the trip.
  function preserveUrlBeforeNavigatingAway(): void {
    window.history.replaceState(null, "", `/customize?${buildOrderParams().toString()}`);
  }

  // A plain HTML page (no PDF, no blob: URL) showing the finished design —
  // meant to be shared as-is (e.g. pasted into LINE) so the shop can just
  // open it, instead of trying to forward the PDF itself, which breaks
  // when the sender's copy of it is a blob: URL (see handleGeneratePDF).
  function buildOrderUrl(): string {
    return `${window.location.origin}/order?${buildOrderParams().toString()}`;
  }

  async function handleShareLink() {
    const url = buildOrderUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: "My NFC CD Keychain order", url });
        return;
      } catch {
        // User cancelled the share sheet, or the platform rejected it —
        // fall through to the clipboard copy below rather than leaving
        // them with no way to get the link at all.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatusMessage("Link copied! Paste it into LINE to send it to us.");
    } catch (error) {
      console.error("Failed to copy order link:", error);
      setStatusMessage(`Here's your order link: ${url}`);
    }
  }

  async function handleGeneratePDF() {
    if (inAppBrowser) {
      // In-app browsers (LINE, etc.) can't navigate to a blob: URL — it
      // either renders blank (opened as a new tab, since that spawns a
      // separate embedded webview that can't resolve a blob: URL created
      // in this one) or triggers an "open external app?" prompt that goes
      // nowhere (same-tab navigation to blob:). A plain GET URL sidesteps
      // both: it's a normal https:// resource, no blob involved. Some
      // in-app browsers still can't render a PDF response at all though
      // (see the notice next to the button).
      setGenerating(true);
      setStatusMessage("");
      const sent = await notifyShop();
      setGenerating(false);
      if (!sent) {
        setStatusMessage(
          "We couldn't send your order automatically — please contact us to confirm it went through."
        );
      }
      preserveUrlBeforeNavigatingAway();
      window.location.href = buildPdfUrl();
      return;
    }

    const isMobile = isMobileBrowser();

    // Mobile browsers only allow window.open() when it's called
    // synchronously inside the click handler — any await before it (the
    // fetches below can take a few seconds once deployed) makes them
    // treat it as an untrusted popup and silently block it. Opening a
    // blank tab right now, then pointing it at the PDF once it's ready,
    // keeps the open() call inside the trusted gesture window.
    const pendingTab = isMobile ? window.open("", "_blank") : null;

    setGenerating(true);
    setStatusMessage("");
    try {
      if (isMobile) {
        // Same reasoning as the in-app-browser branch above: a blob: URL
        // only resolves in the browsing context that created it. On
        // desktop that's not an issue because window.open() there reuses
        // the opener's process, but on Android Chrome a window.open()
        // tab commonly ends up in a *different* renderer process, so
        // handing that tab a blob: URL created back in the opener just
        // fails silently — the tab stays blank. Point it at the plain
        // GET URL instead: a normal https:// navigation, no blob
        // involved, so it works the same regardless of process.
        //
        // forceDownload=true here (unlike the in-app-browser branch
        // above) so the browser saves an actual PDF file instead of
        // showing it in its own inline viewer — forwarding *that* later
        // (tapping share/copy from inside the viewer) is what produced
        // the "not found" / WebKitBlobResource errors customers hit,
        // since some inline PDF viewers hand off a blob: reference of
        // their own instead of the page's real URL. A downloaded file has
        // no such ambiguity: it can be shared as a real attachment
        // straight from LINE, which always works for the recipient.
        const shopSent = await notifyShop();
        const pdfUrl = buildPdfUrl(true);
        if (pendingTab) {
          pendingTab.location.href = pdfUrl;
        } else {
          // The synchronous window.open() above got blocked anyway —
          // fall back to a same-tab navigation, which isn't blocked.
          preserveUrlBeforeNavigatingAway();
          window.location.href = pdfUrl;
        }
        setStatusMessage(
          shopSent
            ? "Your PDF has downloaded and your order has been sent! You can also share the link below."
            : "Your PDF has downloaded, but we couldn't send your order automatically — please contact us to confirm it went through."
        );
        return;
      }

      const [shopSent, res] = await Promise.all([
        notifyShop(),
        fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: uploadedUrls,
            adjustments,
            customerName: customer?.name,
          }),
        }),
      ]);

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const pdfBlob =
        blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "keychain-order.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Give the browser time to open/download before revoking the URL.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setStatusMessage(
        shopSent
          ? "Your PDF is ready and your order has been sent!"
          : "Your PDF is ready, but we couldn't send your order automatically — please contact us to confirm it went through."
      );
    } catch (error) {
      console.error(error);
      pendingTab?.close();
      setStatusMessage("Could not generate the PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const completedCount = slots.filter((s) => uploadedUrls[s.id]).length;

  // Waiting on the sessionStorage check in the effect above — render
  // nothing rather than flashing the form before a possible redirect.
  // Same null output on the server and the client's first pass avoids a
  // hydration mismatch; the real content only appears after that check
  // resolves on the client.
  if (!checkedCustomer || !customer) return null;

  return (
    <main className="min-h-dvh bg-background relative overflow-hidden">
      {/* Soft decorative glow — purely atmospheric, ignore for layout */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-brand/5 blur-3xl"
      />

      {/* Header */}
      <header className="relative border-b border-brand/10 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-24 shrink-0">
              <img
                src="/pic/IMG_2488.png"
                alt="Gilly Gift & Craft"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-24 w-48 object-cover object-center"
              />
            </div>
          </div>
          <p className="text-sm text-foreground/60">
            Hi, {customer.name}
          </p>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-8 py-12">
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3 text-foreground">
          Customize Your NFC CD Keychain
        </h1>

        <p className="text-foreground/60 mb-10 max-w-xl">
          Click any section in the preview below to add or change its photo
          — we&apos;ll turn it into print-ready artwork.
        </p>

        {/* Progress */}
        <div className="mb-6 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground/70">
            {completedCount} of {slots.length} sections added
          </span>
          <span className="text-brand font-semibold">
            {Math.round((completedCount / slots.length) * 100)}%
          </span>
        </div>
        <div className="mb-10 h-1.5 w-full rounded-full bg-brand/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${(completedCount / slots.length) * 100}%` }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <TemplatePreview
          uploadedUrls={uploadedUrls}
          uploadingSlots={uploadingSlots}
          adjustments={adjustments}
          onAdjustChange={handleAdjustChange}
          onSlotClick={handleSlotClick}
          onRemove={handleRemoveSlot}
        />

        <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-8 border border-brand/10">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleGeneratePDF}
              disabled={generating || anyUploading}
              className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 transition shadow-lg shadow-brand/20 hover:shadow-brand/30"
            >
              {generating ? "Generating..." : "Generate PDF"}
            </button>

            <button
              onClick={handleShareLink}
              disabled={anyUploading || completedCount === 0}
              className="bg-white hover:bg-brand/5 text-brand border border-brand/30 px-6 py-3 rounded-xl font-medium disabled:opacity-50 transition"
            >
              Share Link
            </button>
          </div>

          {anyUploading && (
            <p className="mt-4 text-sm text-brand">
              Still uploading one or more images — please wait a moment
              before generating the PDF.
            </p>
          )}

          {!anyUploading && inAppBrowser && (
            <p className="mt-4 text-sm text-foreground/60">
              You&apos;re viewing this inside an app (e.g. LINE), which
              sometimes can&apos;t display a PDF directly — if it
              doesn&apos;t seem to do anything, open this page in
              Safari/Chrome instead (⋯ menu → Open in Browser). Your order
              is still sent to us either way.
            </p>
          )}

          {!anyUploading && statusMessage && (
            <p className="mt-4 text-sm text-foreground/60">{statusMessage}</p>
          )}
        </div>

        <p className="text-center text-xs text-brand-dark/40 mt-12 tracking-wide">
          Gilly Gift &amp; Craft — handmade to order
        </p>
      </div>
    </main>
  );
}
