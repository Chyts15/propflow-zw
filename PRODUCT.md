# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two sides of one rental relationship in Zimbabwe, both on the same web app (installable PWA):

- **Landlords and property agencies** (primary for the current design pass). They own or manage a handful to dozens of units and are the paying customers. They need to know who has paid, who is late, what is broken, and what the month looks like in USD and ZiG. They work from a desktop at the desk and from a phone on the move.
- **Tenants.** Included free at every tier. They check what they owe, upload proof of payment, and report problems. The median tenant is on an Android phone on Econet mobile data, often a slow connection.

## Product Purpose

PropFlow Zimbabwe is a two-sided property-management SaaS: a rent ledger, a payment-proof workflow, and complaint tracking between landlord and tenant. Success is rent that gets paid on time, with a clear record both sides trust, and problems that get reported and resolved instead of lost in WhatsApp threads. Manifest tagline: "PropFlow gets your rent paid on time."

## Positioning

Rent tracking built for how Zimbabwe actually pays: EcoCash first, payment proofs as evidence, USD shown alongside ZiG, SMS for alerts. It replaces WhatsApp screenshots and notebooks. (Confirmed by the owner.)

## Operating Context

- Mobile-first, low-bandwidth reality: skeletons, optimistic UI, graceful slow-API states, compressed and lazy-loaded images.
- Rent is paid outside the app (mobile money, cash). Tenants upload proof; landlords mark it paid. There is no in-app rent payment in Phase 1.
- Landlords pay PropFlow itself through Paynow subscription billing. Tenants are never charged and the tenant portal is never a gated feature.
- Two portals: landlord (dashboard, properties and units, tenants, finances, complaints, settings, billing) and tenant (home, rent, complaints). Plus public landing, sign-in, sign-up, and a privacy page.

## Capabilities and Constraints

- Plans: TRIAL (30 days, full access), STARTER $10 up to 10 units, PRO $25 up to 40 units, AGENCY $99 unlimited. Over-limit or gated landlord features render blurred with an upgrade prompt to billing. Never hard-block, never delete data. PAST_DUE means landlord read-only after a 7-day grace. Tenant reads are never gated by landlord billing status.
- Locale rules: dates as "Monday, 22 June 2026", never MM/DD/YYYY. Currency as "$1,200 USD" and "ZiG 15,000", always showing USD alongside ZiG. Phones as +263 7X XXX XXXX. EcoCash is first in every payment-method list; references validate as EC plus 10 digits. Examples use Zimbabwean names and suburbs.
- Status vocabulary: OPEN, IN_PROGRESS, RESOLVED, CRITICAL for complaints.
- No `nationalId` field, no logging of phone numbers or PII. Cursor pagination, 20 per page.
- Phase 1 scope only. Not built and not to be implied in the UI: Stripe, Flutterwave, in-app rent payment, offline sync, health score, announcements, documents, load shedding, white-label, analytics, PDFs. SMS is scaffolded but not yet live.
- Project is Next.js 16 App Router, Tailwind 4, shadcn/ui, framer-motion. Rules for the stack live in `AGENTS.md` and `CLAUDE.md`.

## Brand Commitments

The name "PropFlow Zimbabwe" and the visual identity rules written in `CLAUDE.md` under "PropFlow Design System" (landlord and tenant color roles, type families, card treatment, status colors, motion, no textures or hairline dividers) are binding and are preserved by refinement work. Not duplicated here. Logo concepts and a screens overview deck are in `design-reference/`.

## Evidence on Hand

- `design-reference/PropFlow-ZW-Screens-Overview.pptx` and `design-reference/propflow-logo-concepts.jpg`.
- A privacy disclosure at `app/privacy/page.tsx`.
- Seed data in `prisma/seed.ts` for realistic screens.
- Absent, and not to be fabricated: customer counts, testimonials, case studies, press. The product has not launched yet.

## Product Principles

1. **Evidence over assertion.** Rent state is shown with its proof and its history; money never changes silently.
2. **Built for the small, slow phone first.** Every screen must read and act well on a budget Android over weak data before it is made richer on desktop.
3. **Local by default.** Zimbabwean formats, names, suburbs, and payment methods, with EcoCash first and USD beside ZiG.
4. **Tenants are never the pressure point.** Billing and tier limits land on landlord-side capability only, softly, without data loss.
5. **Only what exists.** The UI shows Phase 1 reality and does not tease or imply features that are not built.

## Accessibility & Inclusion

No formal standard (such as WCAG AA) has been specified yet; recorded as an open decision. Established needs: low-bandwidth and small-screen usability, readable contrast outdoors on phones, and plain, unambiguous language for non-technical users.
