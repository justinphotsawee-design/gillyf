"use client";

import { useRef, useState } from "react";
import TemplatePreview from "./components/TemplatePreview";
import { uploadImage } from "./lib/upload";

const slots = [
  { id: "coverFront", label: "Cover Front" },
  { id: "coverBack", label: "Cover Back" },
  { id: "backOuter", label: "Back Outer" },
  { id: "backInner", label: "Back Inner" },
  { id: "packagingLeft", label: "Packaging Left" },
  { id: "packagingRight", label: "Packaging Right" },
];

export default function Home() {
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>(
    {}
  );
  const [uploadingSlots, setUploadingSlots] = useState<
    Record<string, boolean>
  >({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<string | null>(null);

  const anyUploading = Object.values(uploadingSlots).some(Boolean);

  function handleSlotClick(slotId: string) {
    pendingSlotRef.current = slotId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slotId = pendingSlotRef.current;
    if (!file || !slotId) return;

    // Show an immediate local preview while the real upload happens.
    setUploadedUrls((prev) => ({ ...prev, [slotId]: URL.createObjectURL(file) }));
    setUploadingSlots((prev) => ({ ...prev, [slotId]: true }));

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
      pendingSlotRef.current = null;
      // Allow re-selecting the same file again later.
      e.target.value = "";
    }
  }

  async function handleSaveDesign() {
    setSaving(true);
    setStatusMessage("");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: labelledImages() }),
      });

      if (!res.ok) throw new Error("Save failed");
      setStatusMessage("Design saved and order email sent!");
    } catch (error) {
      console.error(error);
      setStatusMessage("Something went wrong while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePDF() {
    const isMobile =
      typeof navigator !== "undefined" &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Mobile browsers only allow window.open() when it's called
    // synchronously inside the click handler — any await before it (the
    // fetch below can take a few seconds once deployed) makes them treat
    // it as an untrusted popup and silently block it. Opening a blank tab
    // right now, then pointing it at the PDF once it's ready, keeps the
    // open() call inside the trusted gesture window.
    const pendingTab = isMobile ? window.open("", "_blank") : null;

    setGenerating(true);
    setStatusMessage("");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: uploadedUrls }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const pdfBlob =
        blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);

      if (isMobile) {
        // iOS/Android don't reliably honor the `download` attribute on
        // blob links. Opening the PDF in a new tab lets the phone's
        // built-in PDF viewer show its own Save/Share button instead.
        if (pendingTab) {
          pendingTab.location.href = url;
        } else {
          // The synchronous window.open() above was itself blocked
          // (e.g. popups disabled entirely) — fall back to a same-tab
          // navigation, which isn't blocked.
          window.location.href = url;
        }
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "keychain-order.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      // Give the browser time to open/download before revoking the URL.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      pendingTab?.close();
      setStatusMessage("Could not generate the PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function labelledImages() {
    const result: Record<string, string> = {};
    for (const slot of slots) {
      if (uploadedUrls[slot.id]) {
        result[slot.label] = uploadedUrls[slot.id];
      }
    }
    return result;
  }

  const completedCount = slots.filter((s) => uploadedUrls[s.id]).length;

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
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
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full border-2 border-brand flex items-center justify-center bg-white">
            <span className="font-script text-2xl text-brand leading-none">
              G
            </span>
          </div>
          <div className="leading-tight">
            <p className="font-script text-2xl text-brand -mb-1">Gilly</p>
            <p className="text-[0.6rem] tracking-[0.35em] text-brand-dark/60 uppercase">
              Gift &amp; Craft
            </p>
          </div>
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
          onSlotClick={handleSlotClick}
        />

        <div className="bg-white rounded-3xl shadow-xl shadow-brand/5 p-8 border border-brand/10">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleSaveDesign}
              disabled={saving || anyUploading}
              className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 transition shadow-lg shadow-brand/20 hover:shadow-brand/30"
            >
              {saving ? "Saving..." : "Save Design"}
            </button>

            <button
              onClick={handleGeneratePDF}
              disabled={generating || anyUploading}
              className="border border-brand text-brand hover:bg-brand/5 px-6 py-3 rounded-xl font-medium disabled:opacity-50 transition"
            >
              {generating ? "Generating..." : "Generate PDF"}
            </button>
          </div>

          {anyUploading && (
            <p className="mt-4 text-sm text-brand">
              Still uploading one or more images — please wait a moment
              before saving or generating the PDF.
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
