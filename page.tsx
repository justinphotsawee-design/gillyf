"use client";

import { useState } from "react";

const slots = [
  {
    id: "coverFront",
    label: "Cover Front",
  },
  {
    id: "coverBack",
    label: "Cover Back",
  },
  {
    id: "backOuter",
    label: "Back Outer",
  },
  {
    id: "backInner",
    label: "Back Inner",
  },
  {
    id: "packagingLeft",
    label: "Packaging Left",
  },
  {
    id: "packagingRight",
    label: "Packaging Right",
  },
];

export default function Home() {
  const [activeSlot, setActiveSlot] = useState("coverFront");

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-4xl font-bold mb-2">
          Customize Your NFC CD Keychain
        </h1>

        <p className="text-gray-600 mb-8">
          Upload images for each section and preview your design.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setActiveSlot(slot.id)}
              className={`rounded-xl border p-5 text-left transition ${
                activeSlot === slot.id
                  ? "bg-black text-white border-black"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold">
                {slot.label}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">
              {
                slots.find(
                  (s) => s.id === activeSlot
                )?.label
              }
            </h2>
          </div>

          <input
            type="file"
            accept="image/*"
            className="mb-6"
          />

          <div className="border-2 border-dashed rounded-xl h-[500px] flex items-center justify-center bg-gray-50">
            <p className="text-gray-400">
              Canvas Preview (Konva จะถูกเพิ่มในขั้นต่อไป)
            </p>
          </div>

          <div className="mt-8 flex gap-4">
            <button className="px-6 py-3 rounded-xl bg-black text-white">
              Save Design
            </button>

            <button className="px-6 py-3 rounded-xl border">
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}