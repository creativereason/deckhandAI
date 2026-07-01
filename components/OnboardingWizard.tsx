"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppConfig } from "@/lib/config";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";

const TOTAL_STEPS = 4;

interface Props {
  onComplete: (config: AppConfig) => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Contact
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");

  // Step 2 — Location
  const [hubCity, setHubCity] = useState("");
  const [hubState, setHubState] = useState("");
  const [hubZip, setHubZip] = useState("");
  const [hubRadius, setHubRadius] = useState("25");
  const [openToRemote, setOpenToRemote] = useState(true);
  const [openToHybrid, setOpenToHybrid] = useState(true);

  // Step 3 — Job preferences
  const [titlesRaw, setTitlesRaw] = useState("");
  const [minFte, setMinFte] = useState("");
  const [minHourly, setMinHourly] = useState("");
  const [openToContract, setOpenToContract] = useState(true);

  function canAdvance() {
    if (step === 1) return firstName.trim().length > 0;
    return true;
  }

  async function finish() {
    setSaving(true);
    const config: AppConfig = {
      candidate: {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email,
        phone,
        website,
        linkedin,
      },
      preferences: {
        titles: titlesRaw.split("\n").map((t) => t.trim()).filter(Boolean),
        salary: {
          min_fte: parseInt(minFte) || 0,
          min_contract_hourly: parseInt(minHourly) || 0,
        },
        open_to_contract: openToContract,
        locations: {
          remote: openToRemote,
          hybrid: openToHybrid,
          hub_city: hubCity,
          hub_state: hubState,
          hub_zip: hubZip,
          hub_radius_miles: parseInt(hubRadius) || 25,
        },
      },
      scraping: { schedule: "0 8 * * 1-5" },
      ai: { provider: "anthropic", model: "claude-sonnet-4-6", base_url: null },
    };

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      onComplete(config);
    } catch (err) {
      toast.error(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-p-dark-surface rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-2 mb-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < step ? "bg-p-accent dark:bg-p-accent-inv" : "bg-p-linen dark:bg-p-dark-mid"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-p-dusk dark:text-gray-400 mt-2">Step {step} of {TOTAL_STEPS}</p>
        </div>

        {/* Body */}
        <div className="px-8 pb-8 space-y-5">

          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to deckhandAI</h2>
                <p className="text-sm text-p-dusk dark:text-gray-400 mt-1">Let&apos;s get your profile set up. This takes about 2 minutes.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>First name <span className="text-red-400">*</span></label>
                  <input className={INPUT} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className={LABEL}>Last name</label>
                  <input className={INPUT} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Website</label>
                <input className={INPUT} placeholder="https://yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>LinkedIn</label>
                <input className={INPUT} placeholder="https://linkedin.com/in/yourhandle" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Location</h2>
                <p className="text-sm text-p-dusk dark:text-gray-400 mt-1">Used to filter hybrid and local roles by commute distance.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className={LABEL}>City</label>
                  <input className={INPUT} placeholder="St. Louis" value={hubCity} onChange={(e) => setHubCity(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>State</label>
                  <input className={INPUT} placeholder="MO" maxLength={2} value={hubState} onChange={(e) => setHubState(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>ZIP</label>
                  <input className={INPUT} placeholder="63101" value={hubZip} onChange={(e) => setHubZip(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Hybrid commute radius (miles)</label>
                <input type="number" className={INPUT} value={hubRadius} onChange={(e) => setHubRadius(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv" checked={openToRemote} onChange={(e) => setOpenToRemote(e.target.checked)} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Open to remote roles</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv" checked={openToHybrid} onChange={(e) => setOpenToHybrid(e.target.checked)} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Open to hybrid roles</span>
                </label>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Job preferences</h2>
                <p className="text-sm text-p-dusk dark:text-gray-400 mt-1">Used to filter scraped roles and personalize your tracker.</p>
              </div>
              <div>
                <label className={LABEL}>Target titles (one per line)</label>
                <textarea
                  rows={4}
                  className={INPUT}
                  placeholder={"Senior UX Designer\nDirector of Product Design\nHead of Design"}
                  value={titlesRaw}
                  onChange={(e) => setTitlesRaw(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Min salary — FTE ($/yr)</label>
                  <input type="number" className={INPUT} placeholder="150000" value={minFte} onChange={(e) => setMinFte(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Min rate — Contract ($/hr)</label>
                  <input type="number" className={INPUT} placeholder="75" value={minHourly} onChange={(e) => setMinHourly(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-p-accent dark:accent-p-accent-inv" checked={openToContract} onChange={(e) => setOpenToContract(e.target.checked)} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Open to staffing / contract roles</span>
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">You&apos;re all set</h2>
                <p className="text-sm text-p-dusk dark:text-gray-400 mt-1">
                  Your profile is ready. A couple of things to do next:
                </p>
              </div>
              <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="text-p-accent dark:text-p-accent-inv font-bold mt-0.5">1.</span>
                  <span>
                    Go to <strong>Settings → AI Model</strong> to configure your AI provider and API key.
                    You can use Anthropic, OpenAI, Gemini, Grok, or a local Ollama model.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-p-accent dark:text-p-accent-inv font-bold mt-0.5">2.</span>
                  <span>
                    Add your work history to <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded">data/profile.json</code> — that&apos;s what the AI uses to write cover letters and tailoring notes.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-p-accent dark:text-p-accent-inv font-bold mt-0.5">3.</span>
                  <span>
                    Add scrape targets to <code className="text-xs bg-p-linen dark:bg-p-dark-mid px-1.5 py-0.5 rounded">scripts/scrape-careers.mjs</code> to automate finding new roles.
                  </span>
                </li>
              </ul>
              <p className="text-xs text-p-dusk dark:text-gray-400">
                You can update your profile and preferences anytime in Settings.
              </p>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button onClick={() => setStep((s) => s - 1)} variant="ghost">
                ← Back
              </Button>
            ) : (
              <div />
            )}
            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()} size="lg" className="px-6">
                Continue
              </Button>
            ) : (
              <Button onClick={finish} loading={saving} size="lg" className="px-6">
                Go to tracker
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
