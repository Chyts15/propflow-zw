import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getRentHistoryForTenant, getTenancyForTenant } from "@/lib/db/scoped";
import { PaymentProofUpload } from "@/components/tenant/payment-proof-upload";
import { PaymentHistory } from "@/components/tenant/payment-history";
import { TenantRentCard } from "@/components/tenant/rent-card";
import { TENANT_DARK } from "@/components/tenant/theme";
import { ymdOf } from "@/lib/rent-timing";
import { buildRentOverview } from "@/lib/tenant-rent-view";

export default async function TenantRentPage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const [tenancy, { items: records }] = await Promise.all([getTenancyForTenant(user.id), getRentHistoryForTenant(user.id)]);
  const t = TENANT_DARK;

  const overview = buildRentOverview(records, tenancy.rentDueDay, ymdOf(new Date()));

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        Rent
      </h1>

      {overview ? (
        <>
          <div className="mt-6">
            <TenantRentCard view={overview.view} otherUnpaid={overview.otherUnpaid} variant="rent" />
          </div>

          {overview.view.canUploadProof && (
            <div className="mt-4">
              {/* Keyed by record so the draft, photo and "sent" state never carry over to another month. */}
              <PaymentProofUpload key={overview.focus.id} rentRecordId={overview.focus.id} alreadySubmitted={overview.view.proofSent} />
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 rounded-2xl p-5 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
          No rent record yet. It will show here once this month&apos;s rent is set up.
        </p>
      )}

      <h2 className="mt-8 font-heading text-lg font-extrabold" style={{ color: t.fg }}>
        Payment history
      </h2>
      <div className="mt-3">
        <PaymentHistory rows={overview?.history ?? []} />
      </div>
    </div>
  );
}
