"use client";

import { useRouter } from "next/navigation";
import { LANDLORD_DARK } from "@/components/landlord/theme";

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });
}

export function MonthSelector({ value }: { value: string }) {
  const router = useRouter();
  const t = LANDLORD_DARK;

  return (
    <select
      value={value}
      onChange={(e) => router.push(`/finances?month=${e.target.value}`)}
      className="rounded-full px-3 py-1.5 font-mono text-xs"
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
    >
      {monthOptions().map((m) => (
        <option key={m.value} value={m.value} style={{ backgroundColor: t.cardBg }}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
