"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, Briefcase, Home, Inbox, KanbanSquare, MoreHorizontal, Plus, Search, Settings, Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Modal, ModalClose, ModalContent, ModalTrigger } from "@/components/ui/modal";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { BottomNav, NavRail, type NavItemSpec } from "@/components/ui/nav";
import { AIInsight, AskAIButton, AssistantPanel, PromptChip } from "@/components/ai/ai";

const VARIANTS: NonNullable<ButtonProps["variant"]>[] = ["default", "secondary", "outline", "ghost", "destructive", "ai", "link"];
const NAV: NavItemSpec[] = [
  { href: "#today", label: "Today", icon: <Home />, active: false },
  { href: "#board", label: "Board", icon: <KanbanSquare />, active: true },
  { href: "#inbox", label: "Inbox", icon: <Inbox />, active: false, badge: 3 },
  { href: "#jobs", label: "Jobs", icon: <Briefcase />, active: false },
  { href: "#settings", label: "Settings", icon: <Settings />, active: false },
];

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-4 border-t border-border py-8">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="text-xl font-semibold">{title}</h2>
        {note && <p className="max-w-prose text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, cls }: { name: string; cls: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-12 rounded-md border border-border ${cls}`} />
      <code className="text-xs text-muted-foreground">{name}</code>
    </div>
  );
}

export default function Styleguide() {
  const [view, setView] = useState<"list" | "pipeline">("pipeline");
  const [chip, setChip] = useState(true);
  const [radio, setRadio] = useState("anthropic");

  return (
    <main className="mx-auto flex w-full max-w-(--container-content) flex-col px-4 py-8 sm:px-6">
      <PageHeader
        title="Styleguide"
        description="Every component, every variant and state. Hover and focus are live: hover any control, or press Tab. The 'Focus' column forces the keyboard focus ring."
        actions={<Button variant="outline" onClick={() => document.documentElement.classList.toggle("dark")}>Toggle theme</Button>}
      />

      <Section id="color" title="Color roles" note="Roles, not hues. Screens use these names; the hue behind each is free to change in globals.css.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ["background", "bg-background"], ["card", "bg-card"], ["muted", "bg-muted"], ["accent", "bg-accent"], ["border", "bg-border"], ["input", "bg-input"],
            ["primary", "bg-primary"], ["primary-subtle", "bg-primary-subtle"], ["ai", "bg-ai"], ["ai-subtle", "bg-ai-subtle"], ["secondary", "bg-secondary"], ["foreground", "bg-foreground"],
            ["success", "bg-success"], ["success-subtle", "bg-success-subtle"], ["warning", "bg-warning"], ["warning-subtle", "bg-warning-subtle"], ["destructive", "bg-destructive"], ["destructive-subtle", "bg-destructive-subtle"],
          ].map(([n, c]) => <Swatch key={n} name={n} cls={c} />)}
        </div>
      </Section>

      <Section id="type" title="Type, radii, shadows">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-semibold">text-2xl · page title</p>
            <p className="text-xl font-semibold">text-xl · section title</p>
            <p className="text-lg font-semibold">text-lg · modal title</p>
            <p className="text-base font-semibold">text-base · card title</p>
            <p className="text-sm">text-sm · body, the default UI size</p>
            <p className="text-xs text-muted-foreground">text-xs · captions, badges, meta (the floor)</p>
            <p className="font-mono text-sm">font-mono · ids, keys, model names</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[["rounded-sm", "rounded-sm"], ["rounded-md", "rounded-md"], ["rounded-lg", "rounded-lg"], ["rounded-xl", "rounded-xl"]].map(([n, c]) => (
              <div key={n} className={`flex h-16 items-center justify-center border border-border bg-card text-xs ${c}`}>{n}</div>
            ))}
            {[["shadow-sm", "shadow-sm"], ["shadow-md", "shadow-md"], ["shadow-lg", "shadow-lg"]].map(([n, c]) => (
              <div key={n} className={`flex h-16 items-center justify-center rounded-lg bg-card text-xs ${c}`}>{n}</div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="button" title="Button" note="Rows are variants. Columns are states. 'default' is the one primary action per surface; 'ai' is only for actions that call the assistant.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-2 font-medium">Variant</th><th className="font-medium">Default</th><th className="font-medium">Focus</th><th className="font-medium">Disabled</th><th className="font-medium">Loading</th><th className="font-medium">Small</th><th className="font-medium">With icon</th></tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v} className="border-t border-border">
                  <th scope="row" className="py-3 font-mono text-xs font-normal">{v}</th>
                  <td><Button variant={v}>Label</Button></td>
                  <td><Button variant={v} className="force-focus">Label</Button></td>
                  <td><Button variant={v} disabled>Label</Button></td>
                  <td><Button variant={v} loading>Label</Button></td>
                  <td><Button variant={v} size="sm">Label</Button></td>
                  <td><Button variant={v}><Plus />Add</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Large</Button><Button>Default</Button><Button size="sm">Small</Button>
          <IconButton label="Search" variant="outline"><Search /></IconButton>
          <IconButton label="More"><MoreHorizontal /></IconButton>
          <IconButton label="Delete (focus)" variant="outline" className="force-focus"><Trash2 /></IconButton>
          <IconButton label="Disabled" variant="outline" disabled><Archive /></IconButton>
          <AskAIButton />
        </div>
      </Section>

      <Section id="forms" title="Form controls" note="One chrome for Input, Select and Textarea. Errors say what is wrong in text and thicken the border; they never rely on red alone.">
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Company" hint="As it appears on the posting.">{(p) => <Input {...p} placeholder="Acme" />}</Field>
          <Field label="Company (focus)">{(p) => <Input {...p} className="force-focus" defaultValue="Acme" />}</Field>
          <Field label="Company (disabled)">{(p) => <Input {...p} disabled defaultValue="Acme" />}</Field>
          <Field label="Salary" error="Enter a number, like 150000.">{(p) => <Input {...p} defaultValue="abc" />}</Field>
          <Field label="Status" optional>{(p) => <Select {...p} defaultValue="applied"><option value="applied">Applied</option><option value="screening">Screening</option><option value="interview">Interview</option></Select>}</Field>
          <Field label="Status (disabled)">{(p) => <Select {...p} disabled><option>Applied</option></Select>}</Field>
          <Field label="Notes" className="md:col-span-2">{(p) => <Textarea {...p} placeholder="Paste the job description…" />}</Field>
          <Field label="Notes (error)" error="Notes are required to generate a summary.">{(p) => <Textarea {...p} />}</Field>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Checkbox label="Unchecked" /><Checkbox label="Checked" defaultChecked /><Checkbox label="Indeterminate" indeterminate /><Checkbox label="Disabled" disabled /><Checkbox label="Invalid" aria-invalid />
          </div>
          <RadioGroup value={radio} onValueChange={(v) => setRadio(String(v))} aria-label="AI provider">
            <RadioItem value="anthropic" label="Anthropic" description="Claude models" />
            <RadioItem value="openai" label="OpenAI" />
            <RadioItem value="ollama" label="Ollama" description="Local, free" disabled />
          </RadioGroup>
        </div>
      </Section>

      <Section id="badge" title="Badge and status" note="Status and fit always carry an icon and a word. Tone reinforces, never replaces.">
        <div className="flex flex-wrap gap-2">
          {(["neutral", "info", "success", "warning", "danger", "ai", "solid", "outline"] as const).map((v) => <Badge key={v} variant={v}>{v}</Badge>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["applied", "screening", "interview", "offer", "declined"] as const).map((s) => <StatusBadge key={s} kind="status" value={s} />)}
          {(["strong", "good", "caution", "weak"] as const).map((s) => <StatusBadge key={s} kind="fit" value={s} />)}
        </div>
      </Section>

      <Section id="card" title="Card and list rows">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Default</CardTitle><Badge variant="info">Info</Badge></CardHeader><CardContent><CardDescription>Flat surface with a border. The base for panels.</CardDescription></CardContent></Card>
          <Card variant="interactive"><CardHeader><CardTitle>Interactive</CardTitle></CardHeader><CardContent><CardDescription>Lifts on hover and focus. Used for board cards.</CardDescription></CardContent><CardFooter><Button size="sm" variant="outline">Open</Button></CardFooter></Card>
          <Card variant="ai"><CardHeader><CardTitle>AI</CardTitle></CardHeader><CardContent><CardDescription>Content the assistant wrote or proposed.</CardDescription></CardContent></Card>
        </div>
        <AIInsight action={<Button size="sm" variant="ghost">Regenerate</Button>}>Stripe is hiring a creative director to lead brand and event design. Strong overlap with your systems background; comp is above your floor.</AIInsight>
        <ListGroup>
          <ListRow title="Stripe" href="#row" meta="Creative Director" leading={<Briefcase className="size-4" />} trailing={<StatusBadge kind="status" value="interview" />} actions={<IconButton label="More"><MoreHorizontal /></IconButton>} />
          <ListRow title="Linear" meta="Head of Design" trailing={<StatusBadge kind="fit" value="strong" />} selected />
        </ListGroup>
      </Section>

      <Section id="overlay" title="Modal, menu, toast, tooltip">
        <div className="flex flex-wrap items-center gap-3">
          <Modal>
            <ModalTrigger render={<Button variant="outline">Open modal</Button>} />
            <ModalContent title="Add a job" description="Paste a URL and Deckhand will fill in the rest." footer={<><ModalClose render={<Button variant="ghost">Cancel</Button>} /><Button>Add job</Button></>}>
              <Field label="Job URL">{(p) => <Input {...p} placeholder="https://" />}</Field>
            </ModalContent>
          </Modal>
          <Menu>
            <MenuTrigger render={<Button variant="outline">Move to…</Button>} />
            <MenuContent><MenuItem>Applied</MenuItem><MenuItem>Screening</MenuItem><MenuItem destructive>Pass</MenuItem></MenuContent>
          </Menu>
          <Button variant="outline" onClick={() => toast.success("Moved to Screening", { description: "Linear · Head of Design" })}>Success toast</Button>
          <Button variant="outline" onClick={() => toast.error("Could not save", { description: "Check your connection and try again." })}>Error toast</Button>
        </div>
      </Section>

      <Section id="controls" title="Tabs, segmented control, filter chips">
        <Tabs defaultValue="profile">
          <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="model">AI model</TabsTrigger><TabsTrigger value="agents">Agents</TabsTrigger></TabsList>
          <TabsContent value="profile"><p className="text-sm text-muted-foreground">Tabs switch panels within a page.</p></TabsContent>
          <TabsContent value="model"><p className="text-sm text-muted-foreground">Model settings.</p></TabsContent>
          <TabsContent value="agents"><p className="text-sm text-muted-foreground">Agent keys.</p></TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl label="Layout" value={view} onChange={setView} options={[{ value: "list", label: "List" }, { value: "pipeline", label: "Pipeline" }]} />
          <FilterChip pressed={chip} onPressedChange={setChip} count={4}>Strong</FilterChip>
          <FilterChip pressed={!chip} onPressedChange={(p) => setChip(!p)}>Good</FilterChip>
        </div>
      </Section>

      <Section id="states" title="Empty, loading, error">
        <div className="grid gap-4 md:grid-cols-3">
          <Card padding="none"><EmptyState compact icon={<Inbox />} title="Inbox is clear" description="New postings from your scrapes land here." action={<Button variant="outline" size="sm">Run a scrape</Button>} /></Card>
          <Card padding="none"><LoadingState compact label="Loading jobs" /></Card>
          <Card padding="none"><ErrorState compact description="The board could not be loaded." onRetry={() => toast("Retrying")} /></Card>
        </div>
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
      </Section>

      <Section id="nav" title="Navigation and assistant">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3"><p className="text-xs text-muted-foreground">Rail (tablet and up)</p><div className="w-20 rounded-lg border border-border bg-card p-2"><NavRail items={NAV} /></div></div>
          <div className="flex flex-col gap-3"><p className="text-xs text-muted-foreground">Bottom bar (phones)</p><div className="overflow-hidden rounded-lg border border-border"><BottomNav items={NAV} /></div></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-96">
            <AssistantPanel subtitle="Ask about your board" onClose={() => toast("Closed")} footer={<div className="flex gap-2"><Input aria-label="Message" placeholder="Ask Deckhand…" /><Button>Send</Button></div>}>
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-col items-start gap-2"><PromptChip>Which prospects are strong fits?</PromptChip><PromptChip>Draft a cover letter for Stripe</PromptChip></div>
            </AssistantPanel>
          </div>
        </div>
      </Section>
    </main>
  );
}
