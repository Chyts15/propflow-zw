"use client";

import { useState } from "react";
import { Check, MessageSquareText } from "lucide-react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { LANDLORD_DARK } from "@/components/landlord/theme";

type Tier = "STARTER" | "PRO" | "AGENCY";

const PLANS: { tier: Tier; label: string; unitsLabel: string; monthlyUsd: number }[] = [
  { tier: "STARTER", label: "Starter", unitsLabel: "≤10 units", monthlyUsd: 10 },
  { tier: "PRO", label: "Pro", unitsLabel: "≤40 units", monthlyUsd: 25 },
  { tier: "AGENCY", label: "Agency", unitsLabel: "Unlimited", monthlyUsd: 99 },
];

const SMS_BUNDLES = [
  { bundle: "100" as const, qty: 100, priceUsd: 3 },
  { bundle: "500" as const, qty: 500, priceUsd: 12 },
  { bundle: "2000" as const, qty: 2000, priceUsd: 40 },
];

type BillingEventRow = {
  id: string;
  type: string;
  description: string;
  amountUsd: number;
  paynowRef: string | null;
  createdAt: Date;
};

type Org = {
  tier: Tier | "TRIAL";
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  isAnnual: boolean;
  smsCredits: number;
  pastDueSince: Date | null;
};

const STATUS_BADGE: Record<Org["subscriptionStatus"], { bg: string; fg: string; label: string }> = {
  TRIALING: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24", label: "Trial" },
  ACTIVE: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80", label: "Active" },
  PAST_DUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171", label: "Past due" },
  CANCELLED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)", label: "Cancelled" },
};

function historyTitle(type: string, description: string) {
  if (type === "SUBSCRIPTION_PAYMENT") return "Subscription";
  if (type === "SMS_BUNDLE") return description;
  return description;
}

export function BillingPanel({
  org,
  unitCount,
  history,
  graceDaysLeft,
}: {
  org: Org;
  unitCount: number;
  history: BillingEventRow[];
  /** Computed server-side (Date.now() has no business running during client render) — null unless PAST_DUE. */
  graceDaysLeft: number | null;
}) {
  const t = LANDLORD_DARK;
  const [isAnnual, setIsAnnual] = useState(org.isAnnual);

  const initiate = trpc.billing.initiate.useMutation({
    onSuccess: (data) => {
      window.location.href = data.redirectUrl;
    },
    onError: (err) => toast.error(err.message),
  });

  const statusBadge = STATUS_BADGE[org.subscriptionStatus];
  const readOnly = org.subscriptionStatus === "PAST_DUE" && graceDaysLeft !== null && graceDaysLeft <= 0;

  return (
    <div>
      {org.subscriptionStatus === "PAST_DUE" && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}
        >
          {readOnly
            ? "Your subscription is past due and the grace period has ended — your landlord portal is read-only until you renew. Your data is safe; nothing has been deleted."
            : `Your subscription is past due. You have ${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} left before the portal switches to read-only — renew below to stay active.`}
        </div>
      )}

      <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        <div className="flex items-start justify-between">
          <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            {org.subscriptionStatus === "TRIALING" ? "CURRENT PLAN" : "CURRENT SUBSCRIPTION"}
          </p>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}>
            {statusBadge.label}
          </span>
        </div>
        <p className="font-heading mt-1 text-2xl font-extrabold" style={{ color: t.fg }}>
          {org.subscriptionStatus === "TRIALING"
            ? `Free trial${org.tier !== "TRIAL" ? ` · ${PLANS.find((p) => p.tier === org.tier)?.label}-level access` : ""}`
            : org.tier === "TRIAL"
              ? "No active plan"
              : `${PLANS.find((p) => p.tier === org.tier)?.label} · $${PLANS.find((p) => p.tier === org.tier)?.monthlyUsd}/mo`}
        </p>
        <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
          {org.subscriptionStatus === "TRIALING"
            ? `Trial ends ${org.trialEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
            : org.currentPeriodEnd
              ? `Renews ${org.currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${unitCount} units used`
              : `${unitCount} units used`}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-heading text-base font-extrabold" style={{ color: t.fg }}>
          Plans
        </h2>
        <div className="inline-flex items-center gap-2 rounded-lg p-1" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className="rounded-md px-2.5 py-1 font-mono text-[11px]"
            style={!isAnnual ? { backgroundColor: t.accent, color: "#fff" } : { color: t.fgMuted }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className="rounded-md px-2.5 py-1 font-mono text-[11px]"
            style={isAnnual ? { backgroundColor: t.accent, color: "#fff" } : { color: t.fgMuted }}
          >
            Annual <span style={{ color: isAnnual ? "#fff" : "#4ade80" }}>(2 mo free)</span>
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isSameTier = org.tier === plan.tier;
          const isCurrent = isSameTier && org.subscriptionStatus === "ACTIVE";
          const needsRenewal = isSameTier && org.subscriptionStatus === "PAST_DUE";
          const price = isAnnual ? plan.monthlyUsd * 10 : plan.monthlyUsd;
          return (
            <div
              key={plan.tier}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${isCurrent || needsRenewal ? t.accent : t.cardBorder}`,
              }}
            >
              {(isCurrent || needsRenewal) && (
                <span
                  className="mb-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide"
                  style={{ backgroundColor: t.accent, color: "#fff" }}
                >
                  {isCurrent ? "CURRENT PLAN" : "RENEW TO REACTIVATE"}
                </span>
              )}
              <p className="text-sm font-semibold" style={{ color: t.fg }}>
                {plan.label}
              </p>
              <p className="text-xs" style={{ color: t.fgMuted }}>
                {plan.unitsLabel}
              </p>
              <p className="font-heading mt-2 text-xl font-extrabold" style={{ color: t.fg }}>
                ${price}
                <span className="text-xs font-normal" style={{ color: t.fgMuted }}>
                  /{isAnnual ? "yr" : "mo"}
                </span>
              </p>
              <button
                type="button"
                disabled={isCurrent || initiate.isPending}
                onClick={() => initiate.mutate({ kind: "SUBSCRIPTION", tier: plan.tier, isAnnual })}
                className="mt-3 w-full rounded-lg py-2 font-mono text-xs font-medium disabled:opacity-60"
                style={
                  isCurrent
                    ? { backgroundColor: "rgba(255,255,255,0.06)", color: t.fgMuted }
                    : { backgroundColor: t.accentLight, color: "#fff" }
                }
              >
                {isCurrent ? "Current plan" : needsRenewal ? "Renew plan" : "Switch plan"}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 font-heading text-base font-extrabold" style={{ color: t.fg }}>
        SMS bundles
      </h2>
      <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
        {org.smsCredits} credits remaining
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SMS_BUNDLES.map((b) => (
          <div key={b.bundle} className="rounded-2xl p-4 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <MessageSquareText className="mx-auto h-5 w-5" style={{ color: t.accentLight }} />
            <p className="mt-2 text-sm font-semibold" style={{ color: t.fg }}>
              {b.qty} SMS
            </p>
            <p className="text-xs" style={{ color: t.fgMuted }}>
              ${b.priceUsd}
            </p>
            <button
              type="button"
              disabled={initiate.isPending}
              onClick={() => initiate.mutate({ kind: "SMS_BUNDLE", bundle: b.bundle })}
              className="mt-3 w-full rounded-lg py-2 font-mono text-xs font-medium disabled:opacity-60"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: t.fg, border: `1px solid ${t.cardBorder}` }}
            >
              Buy via Paynow
            </button>
          </div>
        ))}
      </div>

      <h2 className="mt-6 font-heading text-base font-extrabold" style={{ color: t.fg }}>
        Billing history
      </h2>
      <div className="mt-3 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        {history.length === 0 && (
          <p className="p-4 text-sm" style={{ color: t.fgMuted }}>
            No billing history yet.
          </p>
        )}
        {history.map((h, i) => (
          <div
            key={h.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: t.fg }}>
                <Check className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
                {historyTitle(h.type, h.description)}
              </p>
              <p className="text-xs" style={{ color: t.fgMuted }}>
                {h.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm" style={{ color: t.fg }}>
                ${h.amountUsd.toLocaleString()}
              </p>
              {h.paynowRef && (
                <p className="font-mono text-[10px]" style={{ color: t.fgFaint }}>
                  {h.paynowRef}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
