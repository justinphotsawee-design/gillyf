"use client";

import { useState } from "react";
import UploadEditor from "@/components/UploadEditor";

const slots = [
  "Cover Front",
  "Cover Back",
  "Back Outer",
  "Back Inner",
  "Packaging Left",
  "Packaging Right",
];

export default function Home() {
  const [activeSlot, setActiveSlot] = useState(slots[0]);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">
        Customize Your NFC CD Keychain
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {slots.map((slot) => (
          <button
            key={slot}
            onClick={() => setActiveSlot(slot)}
            className={`p-4 border rounded-lg ${
              activeSlot === slot
                ? "bg-black text-white"
                : "bg-white"
            }`}
          >
            {slot}
          </button>
        ))}
      </div>

      <UploadEditor slot={activeSlot} />
    </main>
  );
}