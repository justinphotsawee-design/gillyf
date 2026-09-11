"use client";

import { useEffect, useRef, useState } from "react";
import { SlotGrid, DEFAULT_ADJUSTMENT, type Adjustment } from "../components/TemplatePreview";
import { uploadImage } from "../lib/upload";
import { buildOrderParams } from "../lib/orderParams";

// This page has no backend of its own — the URL query string *is* the
// only place a design's photos/positions live (see customize/page.tsx's
// buildOrderParams). So an edit made directly here has nowhere else to go:
// every change is folded back into the address bar via
// history.replaceState (debounced — see the effect below), the same way
// customize/page.tsx's preserveUrlBeforeNavigatingAway keeps that page's
// URL in sync. That means a refresh, or copying the link straight from
// the address bar, always reflects the latest design — including a photo
// just added to a slot the customer originally left empty, or a crop
// fixed here instead of asking them to redo it at /customize.
export default function OrderClient({
  images,
  initialAdjustments,
  customerName,
}: {
  images: Record<string, string>;
  initialAdjustments: Record<string, Adjustment>;
  customerName?: string;
}) {
  const [uploadedUrls, setUploadedUrls] = useState(images);
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [copyStatus, setCopyStatus] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<string | null>(null);

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

  // Mirrors customize/page.tsx's handleFileChange exactly — same local-
  // preview-then-real-upload flow, so a photo added or replaced here
  // behaves identically to one added during the original design.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slotId = pendingSlotRef.current;

    e.target.value = "";
    if (!file || !slotId) return;

    setUploadedUrls((prev) => ({ ...prev, [slotId]: URL.createObjectURL(file) }));
    setUploadingSlots((prev) => ({ ...prev, [slotId]: true }));
    setAdjustments((prev) => ({ ...prev, [slotId]: DEFAULT_ADJUSTMENT }));
    pendingSlotRef.current = null;

    try {
      const url = await uploadImage(file);
      setUploadedUrls((prev) => ({ ...prev, [slotId]: url }));
    } catch (error) {
      console.error(`Upload failed for ${slotId}:`, error);
      setStatusMessage(
        "Couldn't save that photo to the server, so it won't appear in the PDF. Please try again."
      );
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotId]: false }));
    }
  }

  const anyUploading = Object.values(uploadingSlots).some(Boolean);

  // Debounced, not immediate: a drag or pinch gesture calls onAdjustChange
  // (and so re-renders this effect) on every pointer move — easily dozens
  // of times a second. Browsers rate-limit history.replaceState to ~100
  // calls per 10 seconds and throw a SecurityError past that, which a
  // single active drag could hit in under a second if this fired on every
  // change. Waiting for a short pause in updates collapses a whole
  // gesture into the one replaceState call that actually matters — the
  // settled result once the customer stops moving/uploading a photo.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = buildOrderParams(uploadedUrls, adjustments, customerName);
      window.history.replaceState(null, "", `/order?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timeout);
  }, [uploadedUrls, adjustments, customerName]);

  const currentParams = buildOrderParams(uploadedUrls, adjustments, customerName).toString();
  const pdfUrl = `/api/generate-pdf?${currentParams}`;

  async function handleCopyLink() {
    try {
      // Built fresh from state rather than read off window.location.href
      // — the address bar update above is debounced, so right after an
      // edit it can still be lagging up to 400ms behind the latest change.
      const orderUrl = `${window.location.origin}/order?${currentParams}`;
      await navigator.clipboard.writeText(orderUrl);
      setCopyStatus("Link copied!");
    } catch (error) {
      console.error("Failed to copy order link:", error);
      setCopyStatus("Couldn't copy — copy it from the address bar instead.");
    }
  }

  return (
    <>
      <p className="text-xs text-foreground/50 mb-6 -mt-2">
        Click an empty section to add a photo, drag any photo to
        reposition it, or scroll/pinch to zoom — this link updates
        automatically as you go.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <SlotGrid
        uploadedUrls={uploadedUrls}
        uploadingSlots={uploadingSlots}
        adjustments={adjustments}
        onAdjustChange={handleAdjustChange}
        onSlotClick={handleSlotClick}
        onRemove={handleRemoveSlot}
      />

      <div className="flex flex-wrap items-center gap-4 mt-6">
        <a
          href={pdfUrl}
          aria-disabled={anyUploading}
          className={`inline-block bg-brand text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-brand/20 transition ${
            anyUploading
              ? "opacity-50 pointer-events-none"
              : "hover:bg-brand-dark hover:shadow-brand/30"
          }`}
        >
          Open print-ready PDF
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={anyUploading}
          className="bg-white hover:bg-brand/5 text-brand border border-brand/30 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50"
        >
          Copy updated link
        </button>
      </div>

      {anyUploading && (
        <p className="mt-3 text-sm text-brand">
          Still uploading a photo — please wait a moment before opening the
          PDF or copying the link.
        </p>
      )}

      {!anyUploading && copyStatus && (
        <p className="mt-3 text-sm text-foreground/60">{copyStatus}</p>
      )}

      {!anyUploading && statusMessage && (
        <p className="mt-3 text-sm text-foreground/60">{statusMessage}</p>
      )}
    </>
  );
}
