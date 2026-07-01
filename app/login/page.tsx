"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-p-light dark:bg-p-navy flex items-center justify-center px-4">

      <form onSubmit={submit} className="bg-white dark:bg-p-dark-surface rounded-2xl shadow-lg px-8 py-9 w-full max-w-sm space-y-5">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="DeckhandAI" width={52} height={52} />
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">DeckhandAI</h1>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5">Enter your password to continue</p>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1">
            Password
          </label>
          <input
            type="password"
            autoFocus
            required
            className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-blue/30 dark:focus:ring-p-accent-inv/30 transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setShowForgot(true)}
            className="text-xs text-stone-400 dark:text-gray-500"
          >
            Forgot password?
          </Button>
        </div>
      </form>

      {/* Forgot password modal */}
      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowForgot(false)}
        >
          <div
            className="bg-white dark:bg-p-dark-surface rounded-2xl shadow-2xl p-7 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">Password help</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              The login password is set via the{" "}
              <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code>{" "}
              environment variable. To find or reset it:
            </p>
            <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-2.5">
                <span className="text-p-blue dark:text-p-accent-inv font-bold shrink-0">1.</span>
                <span>Check your <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded font-mono">.env.local</code> file in the project root.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-p-blue dark:text-p-accent-inv font-bold shrink-0">2.</span>
                <span>For a hosted deployment (Vercel, Railway, etc.), check the project&apos;s environment variable settings.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-p-blue dark:text-p-accent-inv font-bold shrink-0">3.</span>
                <span>If someone else set up this instance, ask them for the <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded font-mono">APP_PASSWORD</code> value.</span>
              </li>
            </ul>
            <Button onClick={() => setShowForgot(false)} className="mt-6 w-full">
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
