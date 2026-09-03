import { Bell } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getRentHistoryForTenant } from "@/lib/db/scoped";
import { PaymentProofUpload } from "@/components/tenant/payment-proof-upload";
import { PaymentHistory } from "@/components/tenant/payment-history";
import { TENANT_DARK } from "@/components/tenant/theme";

const RENT_STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  PARTIAL: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  PENDING: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  OVERDUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  WAIVED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};

export default async function TenantRentPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { id: true } });
  const { items: history } = await getRentHistoryForTenant(user.id);
  const t = TENANT_DARK;

  const [current, ...past] = history;
  const needsProof = current && (current.status === "PENDING" || current.status === "OVERDUE" || current.status === "PARTIAL");
  const monthLabel = current
    ? new Date(current.periodYear, current.periodMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
    : null;

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Rent
        </h1>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      {current ? (
        <>
          <div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <div className="flex items-start justify-between">
              <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
                {monthLabel}
              </p>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: RENT_STATUS_BADGE[current.status].bg, color: RENT_STATUS_BADGE[current.status].fg }}
              >
                {current.status}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="font-heading text-4xl font-extrabold" style={{ color: t.fg }}>
                ${current.amountDueUsd.toLocaleString()}
              </p>
              {current.amountDueZig != null && (
                <p className="text-sm" style={{ color: t.fgMuted }}>
                  ≈ ZiG {current.amountDueZig.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: t.fgMuted }}>
            Pay your landlord as usual — EcoCash, bank, or cash — then upload your proof below. There&apos;s no
            in-app payment yet.
          </div>

          {needsProof && (
            <div className="mt-4">
              <PaymentProofUpload rentRecordId={current.id} alreadySubmitted={!!current.proofImageUrl} />
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 rounded-2xl p-5 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
          No rent record for this period yet.
        </p>
      )}

      <h2 className="mt-6 font-heading text-lg font-extrabold" style={{ color: t.fg }}>
        Payment history
      </h2>
      <div className="mt-3">
        <PaymentHistory records={past} />
      </div>
    </div>
  );
}
