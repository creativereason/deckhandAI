"use client";
import { useEffect, useState } from "react";
import AIGenerationCard from "@/components/AIGenerationCard";
import { Modal, ModalContent } from "@/components/ui/modal";
import { EmptyState, LoadingState } from "@/components/ui/states";

/**
 * The same generation flow as the job page, in a dialog, so there is one implementation
 * (this used to be a near-copy of AIGenerationCard without the PDF exports).
 */
export default function GenerateModal({ company, role, url, onClose }: { company: string; role: string; url?: string; onClose: () => void }) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { name?: string }) => setHasProfile(!!d?.name))
      .catch(() => setHasProfile(false));
  }, []);

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent title="Generate" description={`${role} at ${company}`} size="lg" className="[&_[data-slot=card]]:border-0">
        {hasProfile === null && <LoadingState compact label="Loading your profile" />}
        {hasProfile === false && <EmptyState compact title="Add your profile first" description="Generation uses your profile as source material. Add it in Settings, then try again." />}
        {hasProfile && <AIGenerationCard company={company} role={role} url={url} hasProfile />}
      </ModalContent>
    </Modal>
  );
}
