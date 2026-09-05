# PropFlow Zimbabwe

Two-sided (landlord/tenant) property-management SaaS for the Zimbabwean
market — rent ledger, complaints, payment-proof workflow, and PropFlow's own
Paynow-billed subscription. See `CLAUDE.md` for the security/design rules
this codebase is built against.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack) + TypeScript
- **Data:** Prisma 7 (driver adapters, `@prisma/adapter-pg`) + PostgreSQL (Neon)
- **API:** tRPC v11
- **Auth:** Clerk (Organizations)
- **Payments:** Paynow Zimbabwe (PropFlow's own subscription billing — no in-app rent payments in Phase 1)
- **SMS:** Africa's Talking (Phase 1, not yet wired — see Known Gaps below)
- **Storage:** Cloudflare R2 (presigned uploads)
- **Cache/rate-limit:** Upstash Redis
- **Monitoring:** Sentry (PII-scrubbed) + PostHog
- **Hosting:** Vercel + Neon

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env` and fill in real
   values. At minimum for local dev you need `DATABASE_URL`, the Clerk keys,
   and `NEXT_PUBLIC_APP_URL`. Everything else (Paynow, R2, Africa's Talking,
   Upstash, Sentry, PostHog) degrades gracefully when unset — each integration
   has an `isXConfigured()` guard (see `lib/payments/paynow.ts`,
   `lib/storage/r2.ts`, `lib/rate-limit.ts`) that throws a clear error or
   no-ops instead of crashing the app.

3. **Database** — for local development, either point `DATABASE_URL` at a
   Neon branch, or run Prisma's local dev database:
   ```bash
   npx prisma dev
   ```
   Then sync the schema (this project uses `db push`, not `migrate` — there
   is no `prisma/migrations` history, schema changes are applied directly):
   ```bash
   npx prisma db push
   ```

4. **Seed data**
   ```bash
   npx prisma db seed
   ```
   (Don't run `prisma/seed.ts` directly with `tsx` — it has no `dotenv/config`
   import and won't pick up your `.env`; `prisma db seed` loads env through
   Prisma's own config.)

5. **Run the dev server**
   ```bash
   npm run dev
   ```

## Deployment

- **Vercel** hosts the app; **Neon** hosts Postgres. Push to `main` and
  deploy with `vercel --prod`.
- Vercel Cron (`vercel.json`) calls `/api/cron/trial-expiry` daily — it's
  protected by `CRON_SECRET`, which must be set in the Vercel project's
  environment variables.
- **Schema changes must be pushed to the production database separately** —
  `vercel --prod` does not run `prisma db push` against Neon for you. After
  deploying a commit with a schema change:
  ```bash
  npx vercel env pull .env.production.local --environment=production
  # then, using the DATABASE_URL from that file:
  DATABASE_URL="<production-url>" npx prisma db push
  ```
  Delete `.env.production.local` afterward — it contains a live database
  credential and must never be committed (`.env*` is gitignored).

## Neon point-in-time recovery (restore procedure)

Neon retains point-in-time history (default retention depends on plan).
If production data needs to be rolled back after a bad migration or bug:

1. **Identify the restore point** — the timestamp just before the bad write/
   migration, in UTC.
2. **Create a new branch from that point in time**, via the Neon console
   (Branches → Create branch → "From a specific time") or the CLI:
   ```bash
   neonctl branches create --project-id <project-id> --parent main --timestamp <ISO-8601>
   ```
   This does not touch `main` — it's a full, independent copy of the database
   as it existed at that timestamp.
3. **Verify the restored branch** before touching production: grab its
   connection string and point a local `DATABASE_URL` at it, then spot-check
   the affected tables (e.g. `RentRecord`, `BillingEvent`, `PaymentEvent` —
   the append-only audit trail on the restored branch tells you exactly what
   was about to be lost).
4. **Promote or cut over:**
   - If the restore should become the new production database: use Neon's
     branch reset/promote flow (Branches → the restored branch → "Set as
     primary", or `neonctl branches set-default`), or
   - If only a subset of rows needs to come back: `pg_dump` the affected
     tables from the restored branch and restore them into `main` with
     `pg_restore` / targeted `INSERT ... ON CONFLICT`, rather than promoting
     the whole branch and losing legitimate writes that happened after the
     incident.
5. **Update `DATABASE_URL`** in Vercel's environment variables if you cut
   over to a different branch's connection string, then redeploy.
6. **Never delete data as a first response** — per `CLAUDE.md` § Tier Gating,
   this codebase's own rule is "never hard-block, never delete data"; the
   same caution applies operationally. Prefer branching + verifying over any
   destructive `DELETE`/`TRUNCATE`.

## Known gaps (Phase 1, intentionally deferred)

- **Africa's Talking SMS** is scaffolded (`lib/sms` conventions referenced in
  `CLAUDE.md`) but not wired to real routers — rent reminders, complaint-
  update SMS, and payment-proof alerts are all on hold pending sender-ID
  registration and a real Africa's Talking account.
- **Paynow** end-to-end payment (initiate → redirect → webhook → activate)
  is fully built and hardened (hash verification, re-poll, idempotency) but
  hasn't been exercised against a real merchant account — `isPaynowConfigured()`
  gates it the same way R2 is gated before real credentials land.
- Renewal-lapse handling for an already-`ACTIVE` org (vs. trial expiry) isn't
  automated yet — only the trial → `PAST_DUE` cron exists.

## Security

See `CLAUDE.md` for the non-negotiable rules this codebase enforces
(org-scoped data access via `lib/db/scoped.ts`, append-only financial
ledger via `PaymentEvent`/`BillingEvent`, no `nationalId` field, PII-scrubbed
Sentry, rate limiting, tenant-access continuity during landlord billing
lapses). `app/privacy/page.tsx` is the user-facing privacy disclosure,
including the cross-border hosting notice required for Zimbabwean data
protection compliance.
