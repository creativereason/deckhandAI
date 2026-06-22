"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      <form onSubmit={submit} className="bg-white dark:bg-p-dark-surface rounded-xl shadow-lg p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Job Tracker</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5">Enter your password to continue</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Password</label>
          <input
            type="password"
            autoFocus
            required
            className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-p-blue dark:bg-p-accent-inv text-white rounded-lg py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
