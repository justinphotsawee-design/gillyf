"use client";

import { useState } from "react";
import UploadEditor from "./components/UploadEditor";

const slots = [
  { id: "coverFront", label: "Cover Front" },
  { id: "coverBack", label: "Cover Back" },
  { id: "backOuter", label: "Back Outer" },
  { id: "backInner", label: "Back Inner" },
  { id: "packagingLeft", label: "Packaging Left" },
  { id: "packagingRight", label: "Packaging Right" },
];

export default function Home() {
  const [activeSlot, setActiveSlot] = useState("coverFront");
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const activeLabel = slots.find((s) => s.id === activeSlot)?.label ?? "";

  function handleUploaded(slotId: string, url: string) {
    setUploadedUrls((prev) => ({ ...prev, [slotId]: url }));
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
    setGenerating(true);
    setStatusMessage("");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: labelledImages() }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "keychain-order.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
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

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-5xl font-bold mb-2">
          Customize Your NFC CD Keychain
        </h1>

        <p className="text-zinc-500 mb-8">
          Upload and customize each section.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setActiveSlot(slot.id)}
              className={`rounded-xl p-5 border transition ${
                activeSlot === slot.id
                  ? "bg-black text-white"
                  : "bg-white hover:bg-zinc-50"
              }`}
            >
              {slot.label}
              {uploadedUrls[slot.id] && (
                <span className="ml-2 text-xs text-emerald-500">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          <UploadEditor
            key={activeSlot}
            slot={activeLabel}
            onUploaded={(url) => handleUploaded(activeSlot, url)}
          />

          <div className="flex gap-4 mt-6">
            <button
              onClick={handleSaveDesign}
              disabled={saving}
              className="bg-black text-white px-6 py-3 rounded-xl disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Design"}
            </button>

            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              className="border px-6 py-3 rounded-xl disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate PDF"}
            </button>
          </div>

          {statusMessage && (
            <p className="mt-4 text-sm text-zinc-600">{statusMessage}</p>
          )}
        </div>
      </div>
    </main>
  );
}
