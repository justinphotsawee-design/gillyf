"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCustomerInfo } from "./lib/customer";
import { clearDesignProgress } from "./lib/design";

export default function Welcome() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setError("");
    // Starting a fresh order — clear any design left in localStorage from
    // a previous customer on this device (see design.ts for why it's
    // localStorage, not sessionStorage, and why that makes this call
    // necessary). A customer resuming their own in-progress order instead
    // hits the browser's back button, which never reaches this handler.
    clearDesignProgress();
    saveCustomerInfo({ name: trimmedName });
    router.push("/customize");
  }

  return (
    <main className="min-h-dvh bg-background relative overflow-hidden flex items-center justify-center px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-brand/5 blur-3xl"
      />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl shadow-brand/5 p-8 sm:p-10 border border-brand/10">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/pic/IMG_2488.JPG"
            alt="Gilly Gift & Craft"
            width={1280}
            height={1280}
            className="h-24 w-auto mb-4"
          />
          <h1 className="font-display text-2xl font-bold text-foreground">
            What&apos;s your name?
          </h1>
          <p className="text-foreground/60 text-sm mt-2">
            We&apos;ll put it on your finished design.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground/70 mb-1.5"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-brand/20 px-4 py-3 text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-brand/20 hover:shadow-brand/30"
          >
            Start Customizing
          </button>
        </form>
      </div>
    </main>
  );
}
