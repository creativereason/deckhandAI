"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { AppConfig } from "@/lib/config";

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

  const titles = ["Welcome to deckhandAI", "Location", "Job preferences", "You're all set"];
  const descriptions = [
    "Let's get your profile set up. This takes about 2 minutes.",
    "Used to filter hybrid and local roles by commute distance.",
    "Used to filter scraped roles and personalize your tracker.",
    "Your profile is ready. A couple of things to do next:",
  ];

  return (
    <Modal open onOpenChange={() => { /* setup is required: it cannot be dismissed */ }}>
      <ModalContent
        hideClose
        title={titles[step - 1]}
        description={`Step ${step} of ${TOTAL_STEPS}. ${descriptions[step - 1]}`}
        footer={
          <>
            {step > 1 && <Button onClick={() => setStep((s) => s - 1)} variant="ghost" className="mr-auto">Back</Button>}
            {step < TOTAL_STEPS
              ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>Continue</Button>
              : <Button onClick={finish} loading={saving}>Go to tracker</Button>}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} className="flex gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => <div key={i} className={`h-2 flex-1 rounded-sm ${i < step ? "bg-primary" : "bg-muted"}`} />)}
          </div>

          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" required>{(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />}</Field>
                <Field label="Last name">{(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} />}</Field>
              </div>
              <Field label="Email">{(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              <Field label="Phone">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
              <Field label="Website">{(p) => <Input {...p} placeholder="https://yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} />}</Field>
              <Field label="LinkedIn">{(p) => <Input {...p} placeholder="https://linkedin.com/in/yourhandle" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />}</Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City">{(p) => <Input {...p} placeholder="St. Louis" value={hubCity} onChange={(e) => setHubCity(e.target.value)} />}</Field>
                <Field label="State">{(p) => <Input {...p} placeholder="MO" maxLength={2} value={hubState} onChange={(e) => setHubState(e.target.value)} />}</Field>
                <Field label="ZIP">{(p) => <Input {...p} placeholder="63101" value={hubZip} onChange={(e) => setHubZip(e.target.value)} />}</Field>
              </div>
              <Field label="Hybrid commute radius (miles)">{(p) => <Input {...p} type="number" value={hubRadius} onChange={(e) => setHubRadius(e.target.value)} />}</Field>
              <div className="flex flex-col gap-2">
                <Checkbox label="Open to remote roles" checked={openToRemote} onCheckedChange={setOpenToRemote} />
                <Checkbox label="Open to hybrid roles" checked={openToHybrid} onCheckedChange={setOpenToHybrid} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Target titles" hint="One per line.">
                {(p) => <Textarea {...p} rows={4} placeholder={"Senior UX Designer\nDirector of Product Design\nHead of Design"} value={titlesRaw} onChange={(e) => setTitlesRaw(e.target.value)} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Min salary, FTE ($/yr)">{(p) => <Input {...p} type="number" placeholder="150000" value={minFte} onChange={(e) => setMinFte(e.target.value)} />}</Field>
                <Field label="Min rate, contract ($/hr)">{(p) => <Input {...p} type="number" placeholder="75" value={minHourly} onChange={(e) => setMinHourly(e.target.value)} />}</Field>
              </div>
              <Checkbox label="Open to staffing / contract roles" checked={openToContract} onCheckedChange={setOpenToContract} />
            </>
          )}

          {step === 4 && (
            <>
              <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
                <li>Go to <strong className="font-semibold">Settings → AI Model</strong> to configure your AI provider and API key. You can use Anthropic, OpenAI, Gemini, Grok, or a local Ollama model.</li>
                <li>Add your work history to <code className="rounded-sm bg-muted px-1 font-mono text-xs">data/profile.json</code>. That is what the AI uses to write cover letters and tailoring notes.</li>
                <li>Add scrape targets to <code className="rounded-sm bg-muted px-1 font-mono text-xs">scripts/scrape-careers.mjs</code> to automate finding new roles.</li>
              </ol>
              <p className="text-xs text-muted-foreground">You can update your profile and preferences anytime in Settings.</p>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
