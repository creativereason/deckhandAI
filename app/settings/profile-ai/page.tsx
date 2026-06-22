"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Profile, ExperienceEntry, EducationEntry } from "@/lib/profile";

const INPUT = "w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white focus:outline-none focus:ring-2 focus:ring-p-accent dark:focus:ring-p-accent-inv";
const LABEL = "block text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest mb-1";
const SECTION = "bg-white dark:bg-p-dark-surface rounded-xl p-5 space-y-4 shadow-sm";
const BTN_SM = "text-xs text-p-dusk dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors";

export default function ProfileAiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => { setProfile(data); setLoading(false); })
      .catch(() => { toast.error("Failed to load profile"); setLoading(false); });
  }, []);

  function update(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  function updateExp(idx: number, patch: Partial<ExperienceEntry>) {
    const next = [...(profile.experience ?? [])];
    next[idx] = { ...next[idx], ...patch };
    update({ experience: next });
  }

  function updateExpBullet(expIdx: number, bulletIdx: number, val: string) {
    const next = [...(profile.experience ?? [])];
    const bullets = [...(next[expIdx].bullets ?? [])];
    bullets[bulletIdx] = val;
    next[expIdx] = { ...next[expIdx], bullets };
    update({ experience: next });
  }

  function addExpBullet(expIdx: number) {
    const next = [...(profile.experience ?? [])];
    next[expIdx] = { ...next[expIdx], bullets: [...(next[expIdx].bullets ?? []), ""] };
    update({ experience: next });
  }

  function removeExpBullet(expIdx: number, bulletIdx: number) {
    const next = [...(profile.experience ?? [])];
    const bullets = next[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    next[expIdx] = { ...next[expIdx], bullets };
    update({ experience: next });
  }

  function addExp() {
    update({
      experience: [...(profile.experience ?? []), { company: "", role: "", start: "", end: null, bullets: [""] }],
    });
  }

  function removeExp(idx: number) {
    update({ experience: (profile.experience ?? []).filter((_, i) => i !== idx) });
  }

  function updateEdu(idx: number, patch: Partial<EducationEntry>) {
    const next = [...(profile.education ?? [])];
    next[idx] = { ...next[idx], ...patch };
    update({ education: next });
  }

  function addEdu() {
    update({ education: [...(profile.education ?? []), { institution: "", degree: "", graduated: "" }] });
  }

  function removeEdu(idx: number) {
    update({ education: (profile.education ?? []).filter((_, i) => i !== idx) });
  }

  function updateRule(idx: number, val: string) {
    const next = [...(profile.writing_rules ?? [])];
    next[idx] = val;
    update({ writing_rules: next });
  }

  function addRule() {
    update({ writing_rules: [...(profile.writing_rules ?? []), ""] });
  }

  function removeRule(idx: number) {
    update({ writing_rules: (profile.writing_rules ?? []).filter((_, i) => i !== idx) });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Profile saved");
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-p-dusk dark:text-gray-400 py-8">Loading…</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-p-dusk dark:text-gray-400">
        This profile is used by the AI to generate cover letters and tailoring notes. It is never committed to your app repo — it lives in your private data repo.
      </p>

      {/* Identity */}
      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Identity</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Full name</label>
            <input className={INPUT} value={profile.name ?? ""} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Title</label>
            <input className={INPUT} placeholder="Senior UX Designer / Director" value={profile.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Professional summary</label>
            <textarea rows={3} className={INPUT} placeholder="2–3 sentences used in generated cover letters" value={profile.summary ?? ""} onChange={(e) => update({ summary: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Portfolio URL</label>
            <input className={INPUT} value={profile.portfolio_url ?? ""} onChange={(e) => update({ portfolio_url: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Portfolio password</label>
            <input className={INPUT} value={profile.portfolio_password ?? ""} onChange={(e) => update({ portfolio_password: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Core strengths (one per line)</label>
          <textarea
            rows={3}
            className={INPUT}
            value={(profile.strengths ?? []).join("\n")}
            onChange={(e) => update({ strengths: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      </div>

      {/* Experience */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Work history</h2>
          <button onClick={addExp} className="text-xs text-p-accent dark:text-p-accent-inv hover:underline">+ Add role</button>
        </div>
        {(profile.experience ?? []).length === 0 && (
          <p className="text-sm text-p-dusk dark:text-gray-400">No work history yet. Add your most recent roles.</p>
        )}
        {(profile.experience ?? []).map((exp, ei) => (
          <div key={ei} className="border border-p-linen dark:border-p-dark-mid rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Company</label>
                <input className={INPUT} value={exp.company} onChange={(e) => updateExp(ei, { company: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Role</label>
                <input className={INPUT} value={exp.role} onChange={(e) => updateExp(ei, { role: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Start (YYYY-MM)</label>
                <input className={INPUT} placeholder="2022-03" value={exp.start} onChange={(e) => updateExp(ei, { start: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>End (YYYY-MM or leave blank for present)</label>
                <input className={INPUT} placeholder="2024-06" value={exp.end ?? ""} onChange={(e) => updateExp(ei, { end: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className={LABEL}>Bullets</label>
              {exp.bullets.map((b, bi) => (
                <div key={bi} className="flex gap-2">
                  <input className={INPUT} value={b} onChange={(e) => updateExpBullet(ei, bi, e.target.value)} />
                  <button onClick={() => removeExpBullet(ei, bi)} className={`${BTN_SM} shrink-0 hover:text-red-600`}>×</button>
                </div>
              ))}
              <button onClick={() => addExpBullet(ei)} className={BTN_SM}>+ bullet</button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => removeExp(ei)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove role</button>
            </div>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Education</h2>
          <button onClick={addEdu} className="text-xs text-p-accent dark:text-p-accent-inv hover:underline">+ Add</button>
        </div>
        {(profile.education ?? []).map((edu, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 border border-p-linen dark:border-p-dark-mid rounded-xl p-4">
            <div className="col-span-2">
              <label className={LABEL}>Institution</label>
              <input className={INPUT} value={edu.institution} onChange={(e) => updateEdu(i, { institution: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Degree</label>
              <input className={INPUT} value={edu.degree} onChange={(e) => updateEdu(i, { degree: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Graduated</label>
              <input className={INPUT} placeholder="2020-05" value={edu.graduated} onChange={(e) => updateEdu(i, { graduated: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-end justify-between gap-3">
              <div className="flex-1">
                <label className={LABEL}>Honors (optional)</label>
                <input className={INPUT} value={edu.honors ?? ""} onChange={(e) => updateEdu(i, { honors: e.target.value })} />
              </div>
              <button onClick={() => removeEdu(i)} className="text-xs text-red-500 hover:text-red-700 pb-2 shrink-0">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Writing rules */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Writing rules</h2>
          <button onClick={addRule} className="text-xs text-p-accent dark:text-p-accent-inv hover:underline">+ Add rule</button>
        </div>
        <p className="text-xs text-p-dusk dark:text-gray-400">Instructions the AI follows when generating documents. Describe tone, style, and anything to avoid.</p>
        {(profile.writing_rules ?? []).map((rule, i) => (
          <div key={i} className="flex gap-2">
            <input className={INPUT} value={rule} onChange={(e) => updateRule(i, e.target.value)} />
            <button onClick={() => removeRule(i)} className={`${BTN_SM} shrink-0 hover:text-red-600`}>×</button>
          </div>
        ))}
        {(profile.writing_rules ?? []).length === 0 && (
          <p className="text-sm text-p-dusk dark:text-gray-400">No rules yet.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-6 py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
