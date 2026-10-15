import { TrendingUp, TrendingDown } from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

// The hero retention metric — spec: "make it prominent."

// pct is null when no rent has fallen due yet this month: show "—" and say so, never "0%".
// detail is the working behind the number ("38 of 42 due paid on time").
export function CollectionsStat({
  pct,
  trend,
  detail,
}: {
  pct: number | null;
  trend: number | null;
  detail?: string;
}) {
  const t = LANDLORD_DARK;
  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
    >
      <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
        ON-TIME COLLECTIONS THIS MONTH
      </p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="font-heading text-5xl font-extrabold" style={{ color: pct == null ? t.fgMuted : t.fg }}>
          {pct == null ? "—" : `${pct}%`}
        </p>
        {trend != null && (
          <span
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: trend >= 0 ? "#4ade80" : "#f87171" }}
          >
            {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trend >= 0 ? "+" : ""}
            {trend}% vs last month
          </span>
        )}
      </div>
      {detail && (
        <p className="mt-2 text-sm" style={{ color: t.fgMuted }}>
          {detail}
        </p>
      )}
    </div>
  );
}
