export type RiskLevel = "low" | "moderate" | "high" | "emergency";

const riskClasses: Record<RiskLevel, { label: string; tone: string }> = {
  low: { label: "Low risk", tone: "bg-success/10 text-success border-success/30" },
  moderate: { label: "Moderate", tone: "bg-warning/10 text-warning border-warning/30" },
  high: { label: "High", tone: "bg-destructive/10 text-destructive border-destructive/30" },
  emergency: { label: "Emergency", tone: "bg-destructive text-destructive-foreground border-destructive" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const r = riskClasses[level] || riskClasses.moderate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${r.tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {r.label}
    </span>
  );
}
