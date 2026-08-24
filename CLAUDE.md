> Also see AGENTS.md for Next.js 16 breaking-change warnings (auto-managed by `next dev` — do not remove that reference).

# PropFlow Zimbabwe — Claude Code Instructions

## SKILL: Security First
- ALL org-owned data access goes through lib/db/scoped.ts — raw prisma calls on
  Property/Unit/Tenancy/Complaint/RentRecord outside that file are a review failure
- Every tRPC procedure uses landlordProcedure or tenantProcedure — never publicProcedure
  for org data
- Financial state changes ALWAYS write a PaymentEvent/BillingEvent — no silent mutations
- Webhooks: verify hash, re-poll source of truth, idempotency check — every time
- Never add a nationalId field. Never log phone numbers or PII.
- Zod schemas on ALL router inputs. Cursor pagination (limit 20) on all lists.
- cuid() IDs in URLs only — never sequential integers.

## SKILL: Zimbabwe Locale
- Dates: "Monday, 22 June 2026" — never MM/DD/YYYY
- Currency: "$1,200 USD" and "ZiG 15,000" — always show USD alongside ZiG
- Phones: +263 7X XXX XXXX
- EcoCash first in every payment method list; validate refs as EC + 10 digits
- Zimbabwean names/suburbs in all examples — never John Smith / Main Street
- Never assume reliable internet: optimistic UI, skeletons, graceful API-slow states

## SKILL: PropFlow Design System
- Landlord: #9A3A1A sidebar, warm stone main. Tenant: #085548 sidebar.
- Plus Jakarta Sans 800 headings, Inter body, JetBrains Mono for refs
- Cards rounded-2xl border-stone-200 shadow-sm — never cold grey
- Complaint cards: dark bg + decoupled underglow per priority (glow ≠ bg token)
- Clean surfaces: no textures, no hairline dividers
- framer-motion 200ms fade+slide-up transitions; skeletons everywhere, zero layout shift
- Status: OPEN=amber, IN_PROGRESS=blue, RESOLVED=green, CRITICAL=red

## SKILL: Africa-First Development
- Mobile-first: median user is Android on Econet data
- SMS over email for all alerts; every send checks smsOptIn inside lib/sms
- SMS opt-out: in-app toggle on Tenant Profile is the primary, authoritative mechanism —
  inbound STOP webhook is best-effort only (two-way SMS is unreliable in Zimbabwe)
- Compress images (sharp / client-side before upload), lazy load everything
- Target minimal first-load JS; skeleton screens on 2G

## SKILL: Tier Gating & Tenant Access
- TRIAL (30 days, full access) | STARTER $10 ≤10 units | PRO $25 ≤40 units | AGENCY $99 unlimited
- PropFlow is B2B2C: landlords pay, tenants are included free at every tier — the tenant
  portal is NEVER itself a gated feature, only landlord-side capability is
- Over-limit or gated landlord features: render blurred with UpgradePrompt → /settings/billing
- Never hard-block, never delete data. PAST_DUE = landlord read-only after 7-day grace.
- Tenant reads (rent history, payment proof, receipts) are NEVER gated by org billing
  status — only tenant-side writes and new SMS are frozen. This is a hard rule, not a
  style preference: violating it is treated as a security-severity bug, not a UX nit.

## SCOPE
Phase 1 only. Do NOT build: Stripe, Flutterwave, in-app rent payment, offline sync,
health score, announcements, documents, load shedding, white-label, analytics, PDFs.

## STACK VERSION NOTE
Next.js 16 (App Router, current stable) + Prisma ORM v7+. If either has moved to a
newer stable release by the time this is built, use the newer stable — do not pin
to an older version out of habit; verify current APIs via Context7 before coding
against either.
