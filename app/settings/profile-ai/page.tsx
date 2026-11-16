"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/states";
import { Notice, SaveBar, SettingsLoading, SettingsSection, SettingsStack } from "@/components/settings/SettingsSection";
import type { Profile, ExperienceEntry, EducationEntry, StrengthGroup } from "@/lib/profile";
import { linesToBullets } from "@/lib/resume-format";

export default function ProfileAiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: Profile) => {
        let migrated = data;
        if (!migrated.strengthGroups?.length && migrated.strengths?.length) {
          migrated = { ...migrated, strengthGroups: [{ label: "Strengths", items: migrated.strengths }] };
        }
        if (!migrated.summaryBullets?.length && migrated.summary) {
          migrated = { ...migrated, summaryBullets: linesToBullets(migrated.summary) };
        }
        setProfile(migrated);
        setLoading(false);
      })
      .catch(() => { toast.error("Failed to load profile"); setLoading(false); });
  }, []);

  function update(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  function updateStrengthGroup(idx: number, patch: Partial<StrengthGroup>) {
    const next = [...(profile.strengthGroups ?? [])];
    next[idx] = { ...next[idx], ...patch };
    update({ strengthGroups: next });
  }

  function addStrengthGroup() {
    update({ strengthGroups: [...(profile.strengthGroups ?? []), { label: "", items: [] }] });
  }

  function removeStrengthGroup(idx: number) {
    update({ strengthGroups: (profile.strengthGroups ?? []).filter((_, i) => i !== idx) });
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

  if (loading) return <SettingsLoading />;

  const addButton = (label: string, onClick: () => void) => <Button onClick={onClick} variant="outline" size="sm"><Plus aria-hidden />{label}</Button>;
  const removeIcon = (label: string, onClick: () => void) => <IconButton label={label} size="icon-sm" onClick={onClick}><X aria-hidden /></IconButton>;

  return (
    <SettingsStack>
      <Notice>
        <p>This profile is used by the AI to generate cover letters and tailoring notes. It is never committed to your app repo; it lives in your private data repo.</p>
      </Notice>

      <SettingsSection title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">{(f) => <Input {...f} value={profile.name ?? ""} onChange={(e) => update({ name: e.target.value })} />}</Field>
          <Field label="Title">{(f) => <Input {...f} placeholder="Senior UX Designer / Director" value={profile.title ?? ""} onChange={(e) => update({ title: e.target.value })} />}</Field>
          <Field label="Profile summary" hint="Bullet points, one per line." className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={4} placeholder={"20+ years leading enterprise UX, product strategy, and design systems\nProven track record building and scaling high-performing design orgs"} value={(profile.summaryBullets ?? []).join("\n")} onChange={(e) => update({ summaryBullets: linesToBullets(e.target.value) })} />}
          </Field>
          <Field label="Portfolio URL">{(f) => <Input {...f} value={profile.portfolio_url ?? ""} onChange={(e) => update({ portfolio_url: e.target.value })} />}</Field>
          <Field label="Portfolio password">{(f) => <Input {...f} value={profile.portfolio_password ?? ""} onChange={(e) => update({ portfolio_password: e.target.value })} />}</Field>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Core strengths</h3>
              <p className="text-xs text-muted-foreground">Optionally split strengths into labeled groups (e.g. UX &amp; Design, Tools, Technical). One group is fine too.</p>
            </div>
            {addButton("Add skill group", addStrengthGroup)}
          </div>
          {(profile.strengthGroups ?? []).map((group, gi) => (
            <Card key={gi} variant="muted" className="gap-3">
              <div className="flex items-end gap-2">
                <Field label="Group label" className="flex-1">{(f) => <Input {...f} placeholder="e.g. UX & Design" value={group.label} onChange={(e) => updateStrengthGroup(gi, { label: e.target.value })} />}</Field>
                {removeIcon(`Remove skill group ${group.label || gi + 1}`, () => removeStrengthGroup(gi))}
              </div>
              <Field label="Items" hint="Comma-separated.">
                {(f) => <Textarea {...f} rows={2} className="min-h-16" placeholder="Product Design, UX Research, Design Systems" value={group.items.join(", ")} onChange={(e) => updateStrengthGroup(gi, { items: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />}
              </Field>
            </Card>
          ))}
          {(profile.strengthGroups ?? []).length === 0 && <Card variant="muted" padding="none"><EmptyState compact title="No skill groups yet" /></Card>}
        </div>
      </SettingsSection>

      <SettingsSection title="Work history" actions={addButton("Add role", addExp)}>
        {(profile.experience ?? []).length === 0 && <Card variant="muted" padding="none"><EmptyState compact title="No work history yet" description="Add your most recent roles." /></Card>}
        {(profile.experience ?? []).map((exp, ei) => (
          <Card key={ei} variant="muted" className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">{(f) => <Input {...f} value={exp.company} onChange={(e) => updateExp(ei, { company: e.target.value })} />}</Field>
              <Field label="Role">{(f) => <Input {...f} value={exp.role} onChange={(e) => updateExp(ei, { role: e.target.value })} />}</Field>
              <Field label="Start" hint="YYYY-MM">{(f) => <Input {...f} placeholder="2022-03" value={exp.start} onChange={(e) => updateExp(ei, { start: e.target.value })} />}</Field>
              <Field label="End" hint="YYYY-MM, or leave blank for present">{(f) => <Input {...f} placeholder="2024-06" value={exp.end ?? ""} onChange={(e) => updateExp(ei, { end: e.target.value || null })} />}</Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Bullets</legend>
              {exp.bullets.map((b, bi) => (
                <div key={bi} className="flex gap-2">
                  <Input aria-label={`Bullet ${bi + 1}`} value={b} onChange={(e) => updateExpBullet(ei, bi, e.target.value)} />
                  {removeIcon(`Remove bullet ${bi + 1}`, () => removeExpBullet(ei, bi))}
                </div>
              ))}
              <div><Button onClick={() => addExpBullet(ei)} variant="outline" size="sm"><Plus aria-hidden />Add bullet</Button></div>
            </fieldset>
            <div className="flex justify-end"><Button onClick={() => removeExp(ei)} variant="ghost" size="sm" className="text-destructive">Remove role</Button></div>
          </Card>
        ))}
      </SettingsSection>

      <SettingsSection title="Education" actions={addButton("Add education", addEdu)}>
        {(profile.education ?? []).map((edu, i) => (
          <Card key={i} variant="muted" className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution" className="sm:col-span-2">{(f) => <Input {...f} value={edu.institution ?? ""} onChange={(e) => updateEdu(i, { institution: e.target.value })} />}</Field>
              <Field label="Degree">{(f) => <Input {...f} value={edu.degree ?? ""} onChange={(e) => updateEdu(i, { degree: e.target.value })} />}</Field>
              <Field label="Graduated">{(f) => <Input {...f} placeholder="2020-05" value={edu.graduated ?? ""} onChange={(e) => updateEdu(i, { graduated: e.target.value })} />}</Field>
              <Field label="Honors" optional className="sm:col-span-2">{(f) => <Input {...f} value={edu.honors ?? ""} onChange={(e) => updateEdu(i, { honors: e.target.value })} />}</Field>
            </div>
            <div className="flex justify-end"><Button onClick={() => removeEdu(i)} variant="ghost" size="sm" className="text-destructive">Remove</Button></div>
          </Card>
        ))}
      </SettingsSection>

      <SettingsSection title="Writing rules" description="Instructions the AI follows when generating documents. Describe tone, style, and anything to avoid." actions={addButton("Add rule", addRule)}>
        {(profile.writing_rules ?? []).map((rule, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={`Rule ${i + 1}`} value={rule} onChange={(e) => updateRule(i, e.target.value)} />
            {removeIcon(`Remove rule ${i + 1}`, () => removeRule(i))}
          </div>
        ))}
        {(profile.writing_rules ?? []).length === 0 && <Card variant="muted" padding="none"><EmptyState compact title="No rules yet" /></Card>}
      </SettingsSection>

      <SaveBar onSave={save} saving={saving}>Save profile</SaveBar>
    </SettingsStack>
  );
}
