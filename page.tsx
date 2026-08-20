"use client";

import { useState } from "react";

const slots = [
  { id: "coverFront", label: "Cover Front" },
  { id: "coverBack", label: "Cover Back" },
  { id: "backOuter", label: "Back Outer" },
  { id: "backInner", label: "Back Inner" },
  { id: "packagingLeft", label: "Packaging Left" },
  { id: "packagingRight", label: "Packaging Right" },
];

export default function Home() {
  const [activeSlot, setActiveSlot] =
    useState("coverFront");

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
              onClick={() =>
                setActiveSlot(slot.id)
              }
              className={`rounded-xl p-5 border transition ${
                activeSlot === slot.id
                  ? "bg-black text-white"
                  : "bg-white hover:bg-zinc-50"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          <h2 className="text-2xl font-semibold mb-4">
            {
              slots.find(
                (s) => s.id === activeSlot
              )?.label
            }
          </h2>

          <input
            type="file"
            accept="image/*"
            className="mb-6"
          />

          <div className="h-[500px] border-2 border-dashed rounded-xl flex items-center justify-center">
            <p className="text-zinc-400">
              Preview Area
            </p>
          </div>

          <div className="flex gap-4 mt-6">
            <button className="bg-black text-white px-6 py-3 rounded-xl">
              Save Design
            </button>

            <button className="border px-6 py-3 rounded-xl">
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}