"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail, saveCustomerInfo } from "./lib/customer";

export default function Welcome() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    saveCustomerInfo({ name: trimmedName, email: trimmedEmail });
    router.push("/customize");
  }

  return (
    <main className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-6">
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
          <div className="h-14 w-14 shrink-0 rounded-full border-2 border-brand flex items-center justify-center bg-white mb-3">
            <span className="font-script text-3xl text-brand leading-none">
              G
            </span>
          </div>
          <p className="font-script text-3xl text-brand -mb-1">Gilly</p>
          <p className="text-[0.6rem] tracking-[0.35em] text-brand-dark/60 uppercase mb-4">
            Gift &amp; Craft
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Let&apos;s get your details
          </h1>
          <p className="text-foreground/60 text-sm mt-2">
            We&apos;ll email your finished design here once it&apos;s ready.
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

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground/70 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
