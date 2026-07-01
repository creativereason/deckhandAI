import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { JobFit, JobStatus, JobType } from "@/lib/jobs";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const FIT_VARIANTS: Record<JobFit, BadgeVariant> = {
  strong: "tone-success",
  good: "tone-info",
  caution: "tone-warning",
  weak: "tone-danger",
};

const STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  applied: "tone-info",
  screening: "tone-warning",
  interview: "tone-purple",
  offer: "tone-success",
  declined: "tone-danger",
};

const TYPE_VARIANTS: Record<JobType, BadgeVariant> = {
  remote: "tone-teal",
  hybrid: "tone-purple",
  local: "tone-warning",
  contract: "tone-orange",
};

const GROUP_VARIANTS: Record<"local" | "remote", BadgeVariant> = {
  local: "tone-purple",
  remote: "tone-neutral",
};

export function fitBadgeVariant(fit: JobFit): BadgeVariant {
  return FIT_VARIANTS[fit];
}

export function statusBadgeVariant(status: JobStatus): BadgeVariant {
  return STATUS_VARIANTS[status];
}

export function typeBadgeVariant(type: JobType): BadgeVariant {
  return TYPE_VARIANTS[type];
}

export function groupBadgeVariant(group: "local" | "remote"): BadgeVariant {
  return GROUP_VARIANTS[group];
}
