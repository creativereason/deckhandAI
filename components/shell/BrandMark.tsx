import { cn } from "@/lib/utils";

// Compass-helm mark (geometry from the DeckhandLogo work in progress), coloured by tokens only:
// ink ring and hub follow the text color, the compass points use the action color.
const CARDINAL_POINTS = [
  "35.0,32.0 39.0,35.2 51.0,32.0 39.0,28.8",
  "32.0,35.0 28.8,39.0 32.0,51.0 35.2,39.0",
  "29.0,32.0 25.0,28.8 13.0,32.0 25.0,35.2",
  "32.0,29.0 35.2,25.0 32.0,13.0 28.8,25.0",
];
const DIAGONAL_POINTS = [
  "34.1,34.1 34.7,39.2 40.5,40.5 39.2,34.7",
  "29.9,34.1 24.8,34.7 23.5,40.5 29.3,39.2",
  "29.9,29.9 29.3,24.8 23.5,23.5 24.8,29.3",
  "34.1,29.9 39.2,29.3 40.5,23.5 34.7,24.8",
];
const HANDLES = "M57.0 32.0L61.5 32.0M49.7 49.7L52.9 52.9M32.0 57.0L32.0 61.5M14.3 49.7L11.1 52.9M7.0 32.0L2.5 32.0M14.3 14.3L11.1 11.1M32.0 7.0L32.0 2.5M49.7 14.3L52.9 11.1";

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)}>
      <circle cx="32" cy="32" r="22" fill="none" strokeWidth="4" className="stroke-foreground" />
      <path d={HANDLES} fill="none" strokeWidth="3.4" strokeLinecap="round" className="stroke-foreground" />
      {DIAGONAL_POINTS.map((p) => <polygon key={p} points={p} className="fill-primary/50" />)}
      {CARDINAL_POINTS.map((p) => <polygon key={p} points={p} className="fill-primary" />)}
      <circle cx="32" cy="32" r="2.6" className="fill-foreground" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      deckhand<span className="font-normal text-primary">AI</span>
    </span>
  );
}
