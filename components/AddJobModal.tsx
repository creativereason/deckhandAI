"use client";
import JobFormModal from "@/components/JobFormModal";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddJobModal({ onClose, onAdded }: Props) {
  return <JobFormModal mode="add" section="prospect" onClose={onClose} onSaved={onAdded} />;
}
