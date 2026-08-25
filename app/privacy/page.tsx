export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl text-stone-900">Privacy Policy</h1>
      <p className="mt-1 font-mono text-xs text-stone-400">
        POTRAZ Data Controller Licence No. [PENDING] — filed under Form DP1
      </p>

      <div className="mt-6 space-y-4 text-sm text-stone-600">
        <p>
          PropFlow Zimbabwe (&quot;PropFlow&quot;) processes personal data — landlord and tenant
          names, phone numbers, unit and property details, rent and payment records — to provide
          the rent-ledger and complaint-management service described at sign-up.
        </p>
        <p>
          <strong className="text-stone-900">Cross-border hosting.</strong> Application data is
          hosted outside Zimbabwe (database: Neon, deployment: Vercel, file storage: Cloudflare
          R2). This transfer is disclosed here and in our POTRAZ Form DP1 filing, per the Cyber
          and Data Protection Act [Chapter 12:07].
        </p>
        <p>
          <strong className="text-stone-900">Data we do not collect.</strong> PropFlow never
          collects national ID numbers. We do not knowingly process data belonging to anyone
          under 18.
        </p>
        <p>
          <strong className="text-stone-900">Tenant data continuity.</strong> If a landlord&apos;s
          subscription lapses, tenants retain indefinite read access to their own rent history,
          payment proof, and receipts — that data is the tenant&apos;s own financial record.
        </p>
        <p>
          <strong className="text-stone-900">Your rights.</strong> You may request a copy of, or
          the deletion of, your personal data by contacting your landlord (for tenant accounts)
          or PropFlow support directly.
        </p>
        <p>
          <strong className="text-stone-900">Data breach notification.</strong> In the event of a
          data breach, PropFlow notifies POTRAZ within 24 hours and affected users within 72
          hours, per SI 155 of 2024.
        </p>
      </div>
    </main>
  );
}
