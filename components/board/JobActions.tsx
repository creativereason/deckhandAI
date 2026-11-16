"use client";
import { CheckCheck, FileText, MoreHorizontal, Sparkles, Wand2 } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import type { JobSection } from "@/lib/jobs";

export interface JobActionHandlers {
  onAsk: () => void;
  onGenerate?: () => void;
  onExportResume?: () => void;
  onExportCoverLetter?: () => void;
  onDismissNew?: () => void;
  moveTargets: { value: JobSection; label: string }[];
  onMove: (target: JobSection) => void;
}

/** "Ask about this job" plus a menu of everything else you can do to it. The same on every card and row. */
export function JobActions({ company, ...h }: JobActionHandlers & { company: string }) {
  return (
    <>
      <IconButton label={`Ask Deckhand about ${company}`} variant="ghost" size="icon-sm" onClick={h.onAsk} className="text-ai"><Sparkles aria-hidden /></IconButton>
      <Menu>
        <MenuTrigger render={<IconButton label={`More actions for ${company}`} variant="ghost" size="icon-sm" />}><MoreHorizontal aria-hidden /></MenuTrigger>
        <MenuContent>
          {h.onDismissNew && <MenuItem onClick={h.onDismissNew}><CheckCheck aria-hidden />Mark reviewed</MenuItem>}
          {h.onGenerate && <MenuItem onClick={h.onGenerate}><Wand2 aria-hidden />Generate…</MenuItem>}
          {h.onExportCoverLetter && <MenuItem onClick={h.onExportCoverLetter}><FileText aria-hidden />Cover letter</MenuItem>}
          {h.onExportResume && <MenuItem onClick={h.onExportResume}><FileText aria-hidden />Resume</MenuItem>}
          {h.moveTargets.length > 0 && <MenuLabel>Move to</MenuLabel>}
          {h.moveTargets.map((t) => <MenuItem key={t.value} onClick={() => h.onMove(t.value)}>{t.label}</MenuItem>)}
        </MenuContent>
      </Menu>
    </>
  );
}
