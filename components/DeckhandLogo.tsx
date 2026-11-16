import { BrandLogo, BrandMark } from "@/components/shell/BrandMark";

// The logo's single implementation lives in components/shell/BrandMark.tsx (token-coloured, follows the theme).
// This file keeps the DeckhandLogo / DeckhandMark API from the logo work in progress.
export const DeckhandMark = BrandMark;

type DeckhandLogoProps = { variant?: "horizontal" | "stacked"; markSize?: number; className?: string };

export default function DeckhandLogo({ variant = "horizontal", markSize = 40, className }: DeckhandLogoProps) {
  return <BrandLogo variant={variant} markSize={markSize} className={className} />;
}
