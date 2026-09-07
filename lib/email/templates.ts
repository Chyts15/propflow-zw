import "server-only";

// Plain TS template literals, mirroring SMS_TEMPLATES' shape (lib/sms/africas-talking.ts).
// No React Email, no new dependencies — see CLAUDE.md § Zimbabwe Locale for
// date/currency formatting rules.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://propflow.co.zw";
const ACCENT = "#9A3A1A"; // landlord sidebar colour, CLAUDE.md § PropFlow Design System

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtUsd(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
}

// orgName traces back to a Clerk user's first/last name — untrusted input —
// and lands directly in an HTML email body, so it gets escaped.
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function wrap(orgName: string, heading: string, body: string, ctaLabel = "Go to Billing", ctaHref = `${APP_URL}/settings/billing`) {
  return `
<div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1c1917;">
  <h1 style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: 800; font-size: 20px; color: ${ACCENT}; margin: 0 0 16px;">
    ${heading}
  </h1>
  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(orgName)},</p>
  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">${body}</p>
  <a href="${ctaHref}" style="display: inline-block; background: ${ACCENT}; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 600;">
    ${ctaLabel}
  </a>
  <p style="font-size: 12px; color: #78716c; margin: 32px 0 0;">PropFlow Zimbabwe</p>
</div>`.trim();
}

export const EMAIL_TEMPLATES = {
  TRIAL_EXPIRING_SOON: (orgName: string, trialEndsAt: Date) => ({
    subject: `Your PropFlow trial ends ${fmtDate(trialEndsAt)}`,
    html: wrap(
      orgName,
      "Your trial ends in 3 days",
      `Your 30-day PropFlow trial ends on <strong>${fmtDate(trialEndsAt)}</strong>. Subscribe now to keep full access to your properties, tenants, and rent ledger with no interruption.`,
      "Choose a plan",
    ),
  }),

  TRIAL_EXPIRED: (orgName: string, graceEndsAt: Date) => ({
    subject: "Your PropFlow trial has ended",
    html: wrap(
      orgName,
      "Your trial has ended",
      `Your PropFlow trial has ended and your account is now past due. You have until <strong>${fmtDate(graceEndsAt)}</strong> before your account becomes read-only. Your data is safe — subscribe any time to restore full access.`,
      "Subscribe now",
    ),
  }),

  RENEWAL_UPCOMING: (orgName: string, tier: string, amountUsd: number, renewsAt: Date) => ({
    subject: `Your PropFlow ${tier} plan renews ${fmtDate(renewsAt)}`,
    html: wrap(
      orgName,
      "Your subscription renews in 3 days",
      `Your ${tier} plan (${fmtUsd(amountUsd)}) is due for renewal on <strong>${fmtDate(renewsAt)}</strong>. Make sure your EcoCash or bank payment is ready via Paynow to avoid any interruption.`,
      "View billing",
    ),
  }),

  RENEWAL_LAPSED: (orgName: string, graceEndsAt: Date) => ({
    subject: "Your PropFlow subscription payment didn't go through",
    html: wrap(
      orgName,
      "We couldn't renew your subscription",
      `We weren't able to confirm your renewal payment, so your account is now past due. You have until <strong>${fmtDate(graceEndsAt)}</strong> before your account becomes read-only. Your data is safe — retry payment any time.`,
      "Retry payment",
    ),
  }),

  PAYMENT_FAILED: (orgName: string) => ({
    subject: "Your PropFlow payment didn't go through",
    html: wrap(
      orgName,
      "Payment didn't go through",
      `Paynow reported that your subscription payment attempt didn't succeed. Your account is still active — please retry from Billing before your current period ends.`,
      "Retry payment",
    ),
  }),

  PAYMENT_RECEIPT: (orgName: string, tier: string, amountUsd: number, periodEnd: Date, reference: string) => ({
    subject: `Receipt: PropFlow ${tier} plan — ${fmtUsd(amountUsd)}`,
    html: wrap(
      orgName,
      "Payment received",
      `We've received your payment of <strong>${fmtUsd(amountUsd)}</strong> for the ${tier} plan. Your subscription is now active until <strong>${fmtDate(periodEnd)}</strong>.<br/><br/>Reference: <span style="font-family: 'JetBrains Mono', monospace;">${reference}</span>`,
      "View billing history",
    ),
  }),
} as const;
