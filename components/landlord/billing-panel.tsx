"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, MessageSquareText, Minus, X } from "lucide-react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";
import { describePlan, nextPeriodEnd, type PaidTier } from "@/lib/billing-plan";
import { formatLongDate } from "@/lib/dates";
import { TIER_PRICES, unitCapFor } from "@/lib/tier";
import { friendlyMessage } from "@/lib/trpc-error";

type Tier = PaidTier;

const PLANS: { tier: Tier; label: string; unitsLabel: string; monthlyUsd: number }[] = [
  { tier: "STARTER", label: "Starter", unitsLabel: "Up to 10 units", monthlyUsd: TIER_PRICES.STARTER },
  { tier: "PRO", label: "Pro", unitsLabel: "Up to 40 units", monthlyUsd: TIER_PRICES.PRO },
  { tier: "AGENCY", label: "Agency", unitsLabel: "Unlimited units", monthlyUsd: TIER_PRICES.AGENCY },
];

// SMS isn't wired to any sending feature yet (rent reminders, complaint
// updates, payment-proof alerts are all unbuilt — see README § Known gaps),
// so nothing ever spends a purchased credit. Hide the purchase path rather
// than let a landlord pay for something that does nothing; flip this back to
// true once SMS ships. Backend (billing.initiate's SMS_BUNDLE handling) is
// untouched — only this UI entry point is gated.
const SMS_BUNDLES_ENABLED = false;

const SMS_BUNDLES = [
  { bundle: "100" as const, qty: 100, priceUsd: 3 },
  { bundle: "500" as const, qty: 500, priceUsd: 12 },
  { bundle: "2000" as const, qty: 2000, priceUsd: 40 },
];

type BillingEventRow = {
  id: string;
  type: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  description: string;
  amountUsd: number;
  paynowRef: string | null;
  createdAt: Date;
  /** Started recently enough that Paynow may still be confirming it (decided on the server). */
  awaiting: boolean;
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

// Every attempt is shown, not just the paid ones: a payment that is still confirming, failed or
// was cancelled must be visible, or a landlord who paid and came back pays again.
const HISTORY_STATUS = {
  PAID: { label: "Paid", fg: "#4ade80", bg: "rgba(74,222,128,0.15)", Icon: Check, note: null },
  CONFIRMING: {
    label: "Confirming",
    fg: "#fbbf24",
    bg: "rgba(251,191,36,0.15)",
    Icon: Clock,
    note: "Waiting for Paynow to confirm. This can take a few minutes.",
  },
  NOT_COMPLETED: {
    label: "Not completed",
    fg: "rgba(255,255,255,0.6)",
    bg: "rgba(255,255,255,0.1)",
    Icon: Minus,
    note: "This payment wasn't completed.",
  },
  FAILED: {
    label: "Failed",
    fg: "#f87171",
    bg: "rgba(248,113,113,0.15)",
    Icon: X,
    note: "Paynow couldn't complete this payment. Choose a plan above to try again.",
  },
  CANCELLED: {
    label: "Cancelled",
    fg: "rgba(255,255,255,0.6)",
    bg: "rgba(255,255,255,0.1)",
    Icon: Minus,
    note: "This payment was cancelled before it completed.",
  },
} as const;

function historyStatus(h: BillingEventRow) {
  if (h.status === "PENDING") return h.awaiting ? HISTORY_STATUS.CONFIRMING : HISTORY_STATUS.NOT_COMPLETED;
  return HISTORY_STATUS[h.status];
}

const usd = (n: number) => n.toLocaleString("en-US");
const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;

export function BillingPanel({
  org,
  unitCount,
  history,
  graceDaysLeft,
  usdToZig,
  now,
}: {
  org: Org;
  unitCount: number;
  history: BillingEventRow[];
  /** Computed server-side (Date.now() has no business running during client render) — null unless PAST_DUE. */
  graceDaysLeft: number | null;
  usdToZig: number | null;
  /** The server's clock for this render: every "days left" and "paid until" is worked out from it. */
  now: Date;
}) {
  const t = LANDLORD_DARK;
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(org.isAnnual);
  const [selected, setSelected] = useState<Tier | null>(null);
  // Stays true once Paynow's URL is in hand, so a double tap can't start a second payment while the
  // browser is leaving. Cleared after a while only so a blocked navigation can't strand the page.
  const [redirecting, setRedirecting] = useState(false);
  const confirmRef = useRef<HTMLElement>(null);

  const initiate = trpc.billing.initiate.useMutation({
    onSuccess: (data) => {
      setRedirecting(true);
      window.setTimeout(() => setRedirecting(false), 15_000);
      window.location.href = data.redirectUrl;
    },
    onError: (err) => {
      toast.error(friendlyMessage(err, "We couldn't open Paynow. Check your connection and try again."));
      // A just-started payment already exists: the history below is the place to look.
      if (err.data?.code === "CONFLICT") router.refresh();
    },
  });

  const busy = initiate.isPending || redirecting;
  const statusBadge = STATUS_BADGE[org.subscriptionStatus];
  const readOnly = org.subscriptionStatus === "PAST_DUE" && graceDaysLeft !== null && graceDaysLeft <= 0;
  const trialEnded = org.tier === "TRIAL" && org.subscriptionStatus === "PAST_DUE";
  const trialDaysLeft = Math.max(Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000), 0);

  // A payment Paynow may still be confirming: say so, and re-read the page for a minute so the
  // result shows up without the landlord having to guess when to reload.
  const awaiting = history.find((h) => h.awaiting);
  const hasAwaiting = Boolean(awaiting);
  useEffect(() => {
    if (!hasAwaiting) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      ticks += 1;
      router.refresh();
      if (ticks >= 6) window.clearInterval(id);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [hasAwaiting, router]);

  // The confirm step opens below the plans; bring it into view on a phone.
  useEffect(() => {
    if (!selected) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    confirmRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  const chosen = selected ? PLANS.find((p) => p.tier === selected)! : null;
  const chosenView = chosen ? describePlan(org, chosen.tier, isAnnual, unitCount) : null;
  const chosenPrice = chosen ? (isAnnual ? chosen.monthlyUsd * 10 : chosen.monthlyUsd) : 0;

  return (
    <div>
      {org.subscriptionStatus === "PAST_DUE" && (
        <div
          role="status"
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}
        >
          {trialEnded
            ? readOnly
              ? "Your free trial has ended and the grace period is over, so your landlord portal is read-only until you choose a plan. Your data is safe; nothing has been deleted."
              : `Your free trial has ended. Choose a plan below within ${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} to keep making changes. Your data is safe; nothing has been deleted.`
            : readOnly
              ? "Your subscription is past due and the grace period has ended — your landlord portal is read-only until you renew. Your data is safe; nothing has been deleted."
              : `Your subscription is past due. You have ${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} left before the portal switches to read-only — renew below to stay active.`}
        </div>
      )}

      {awaiting && (
        <div
          role="status"
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
        >
          <p className="font-medium">A payment is still being confirmed</p>
          <p className="mt-0.5">
            {awaiting.description}, started {formatLongDate(awaiting.createdAt)}. If you paid on Paynow it can take a
            few minutes to clear, and this page updates by itself. If you left Paynow without paying, nothing was
            charged and you can start again below.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className={`mt-1 inline-flex min-h-11 items-center font-mono text-xs font-medium underline underline-offset-2 ${FOCUS_RING}`}
          >
            CHECK AGAIN
          </button>
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
              : `${PLANS.find((p) => p.tier === org.tier)?.label} · $${PLANS.find((p) => p.tier === org.tier)?.monthlyUsd} USD/mo`}
        </p>
        <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
          {org.subscriptionStatus === "TRIALING"
            ? `Trial ends ${formatLongDate(org.trialEndsAt)} · ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left · ${units(unitCount)} used`
            : org.currentPeriodEnd
              ? `Paid until ${formatLongDate(org.currentPeriodEnd)} · ${units(unitCount)} used`
              : `${units(unitCount)} used`}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-extrabold" style={{ color: t.fg }}>
          Plans
        </h2>
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center gap-2 rounded-lg p-1"
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
        >
          <button
            type="button"
            aria-pressed={!isAnnual}
            onClick={() => setIsAnnual(false)}
            className={`min-h-11 rounded-md px-3 font-mono text-[11px] sm:min-h-8 ${FOCUS_RING}`}
            style={!isAnnual ? { backgroundColor: t.accent, color: "#fff" } : { color: t.fgMuted }}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={isAnnual}
            onClick={() => setIsAnnual(true)}
            className={`min-h-11 rounded-md px-3 font-mono text-[11px] sm:min-h-8 ${FOCUS_RING}`}
            style={isAnnual ? { backgroundColor: t.accent, color: "#fff" } : { color: t.fgMuted }}
          >
            Annual <span style={{ color: isAnnual ? "#fff" : "#4ade80" }}>(2 months free)</span>
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const view = describePlan(org, plan.tier, isAnnual, unitCount);
          const price = isAnnual ? plan.monthlyUsd * 10 : plan.monthlyUsd;
          const cap = unitCapFor(plan.tier);
          const highlighted = view.badge !== null || selected === plan.tier;
          return (
            <div
              key={plan.tier}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${highlighted ? t.accent : t.cardBorder}`,
              }}
            >
              {view.badge && (
                <span
                  className="mb-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide"
                  style={{ backgroundColor: t.accent, color: "#fff" }}
                >
                  {view.badge}
                </span>
              )}
              <p className="text-sm font-semibold" style={{ color: t.fg }}>
                {plan.label}
              </p>
              <p className="text-xs" style={{ color: t.fgMuted }}>
                {plan.unitsLabel}
              </p>
              <p className="font-heading mt-2 text-xl font-extrabold tabular-nums" style={{ color: t.fg }}>
                ${price}
                <span className="text-xs font-normal" style={{ color: t.fgMuted }}>
                  {" "}
                  USD / {isAnnual ? "year" : "month"}
                </span>
              </p>
              <p className="mt-1 text-xs tabular-nums" style={{ color: view.overBy > 0 ? "#fbbf24" : t.fgMuted }}>
                {cap === null
                  ? `${units(unitCount)} used`
                  : view.overBy > 0
                    ? `${units(unitCount)}, ${view.overBy} over this plan's ${cap}`
                    : `${unitCount} of ${cap} units used`}
              </p>
              <button
                type="button"
                disabled={busy}
                aria-pressed={selected === plan.tier}
                onClick={() => setSelected(plan.tier)}
                className={`mt-3 min-h-11 w-full rounded-lg font-mono text-xs font-medium text-white disabled:opacity-60 ${FOCUS_RING}`}
                style={{ backgroundColor: t.accentLight }}
              >
                {view.label}
              </button>
            </div>
          );
        })}
      </div>

      {chosen && chosenView && (
        <section
          ref={confirmRef}
          aria-labelledby="confirm-heading"
          className="mt-4 rounded-2xl p-5"
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.accent}` }}
        >
          <h3 id="confirm-heading" className="font-heading text-base font-extrabold" style={{ color: t.fg }}>
            Confirm your payment
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm" style={{ color: t.fg }}>
            <div className="flex justify-between gap-4">
              <dt style={{ color: t.fgMuted }}>Plan</dt>
              <dd>
                {chosen.label} · {isAnnual ? "Annual" : "Monthly"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt style={{ color: t.fgMuted }}>You pay</dt>
              <dd className="text-right tabular-nums">
                ${usd(chosenPrice)} USD
                {usdToZig != null && (
                  <span style={{ color: t.fgMuted }}> · about ZiG {usd(Math.round(chosenPrice * usdToZig))}</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt style={{ color: t.fgMuted }}>Paid until</dt>
              <dd className="text-right">{formatLongDate(nextPeriodEnd(org, chosen.tier, isAnnual, now))}</dd>
            </div>
          </dl>
          {chosenView.overBy > 0 && (
            <p className="mt-3 text-sm" style={{ color: "#fbbf24" }}>
              You have {units(unitCount)} and {chosen.label} covers {unitCapFor(chosen.tier)}. Nothing is deleted, but
              you won&apos;t be able to add more units until you move to a larger plan.
            </p>
          )}
          <p className="mt-3 text-xs" style={{ color: t.fgMuted }}>
            You&apos;ll finish on Paynow&apos;s secure page. Nothing is charged until you pay there.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => initiate.mutate({ kind: "SUBSCRIPTION", tier: chosen.tier, isAnnual })}
              className={`min-h-11 rounded-lg px-4 font-mono text-xs font-medium text-white disabled:opacity-60 ${FOCUS_RING}`}
              style={{ backgroundColor: t.accent }}
            >
              {busy ? "Opening Paynow…" : `Pay $${usd(chosenPrice)} USD with Paynow`}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
              className={`min-h-11 rounded-lg px-4 font-mono text-xs disabled:opacity-60 ${FOCUS_RING}`}
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: t.fgMuted }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {SMS_BUNDLES_ENABLED && (
        <>
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
                  disabled={busy}
                  onClick={() => initiate.mutate({ kind: "SMS_BUNDLE", bundle: b.bundle })}
                  className="mt-3 w-full rounded-lg py-2 font-mono text-xs font-medium disabled:opacity-60"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: t.fg, border: `1px solid ${t.cardBorder}` }}
                >
                  Buy via Paynow
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 font-heading text-base font-extrabold" style={{ color: t.fg }}>
        Billing history
      </h2>
      <div className="mt-3 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        {history.length === 0 && (
          <p className="p-4 text-sm" style={{ color: t.fgMuted }}>
            No billing history yet.
          </p>
        )}
        <ul>
          {history.map((h) => {
            const view = historyStatus(h);
            return (
              <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium" style={{ color: t.fg }}>
                    <span>{h.description}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: view.bg, color: view.fg }}
                    >
                      <view.Icon className="h-3 w-3" aria-hidden />
                      {view.label}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: t.fgMuted }}>
                    {formatLongDate(h.createdAt)}
                  </p>
                  {view.note && (
                    <p className="mt-0.5 text-xs" style={{ color: view.fg }}>
                      {view.note}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums" style={{ color: h.status === "PAID" ? t.fg : t.fgMuted }}>
                    ${usd(h.amountUsd)} USD
                  </p>
                  {h.paynowRef && (
                    <p className="font-mono text-[10px]" style={{ color: t.fgMuted }}>
                      {h.paynowRef}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
