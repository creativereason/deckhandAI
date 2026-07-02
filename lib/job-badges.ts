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

const FALLBACK_VARIANT: BadgeVariant = "tone-neutral";

function lookupVariant<T extends string>(variants: Record<T, BadgeVariant>, value: T): BadgeVariant {
  const normalized = String(value).toLowerCase().trim() as T;
  return variants[normalized] ?? FALLBACK_VARIANT;
}

export function fitBadgeVariant(fit: JobFit): BadgeVariant {
  return lookupVariant(FIT_VARIANTS, fit);
}

export function statusBadgeVariant(status: JobStatus): BadgeVariant {
  return lookupVariant(STATUS_VARIANTS, status);
}

export function typeBadgeVariant(type: JobType): BadgeVariant {
  return lookupVariant(TYPE_VARIANTS, type);
}

export function groupBadgeVariant(group: "local" | "remote"): BadgeVariant {
  return lookupVariant(GROUP_VARIANTS, group);
}
