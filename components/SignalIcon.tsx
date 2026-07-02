import { Zap, Ghost } from "lucide-react";

const CIRCLE_FILL: Record<string, string> = {
  "🟢": "var(--tone-success)",
  "🟡": "var(--tone-warning)",
  "🔴": "var(--destructive)",
};

export function SignalIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  if (icon === "⚡") return <Zap size={size} className="text-tone-warning" fill="currentColor" />;
  if (icon === "👻") return <Ghost size={size} className="text-muted-foreground" />;
  const fill = CIRCLE_FILL[icon];
  if (fill) {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="5" fill={fill} />
      </svg>
    );
  }
  return <span>{icon}</span>;
}
