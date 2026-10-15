import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getTenancyForTenant } from "@/lib/db/scoped";
import { SmsToggle } from "@/components/tenant/sms-toggle";
import { TenantSignOutButton } from "@/components/tenant/sign-out-button";
import { TENANT_DARK } from "@/components/tenant/theme";
import { formatZwPhone } from "@/lib/phone";

export default async function TenantProfilePage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const tenancy = await getTenancyForTenant(user.id);
  const t = TENANT_DARK;

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const { unit } = tenancy;

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        Profile
      </h1>

      <section
        aria-label="Your details"
        className="mt-6 rounded-2xl p-5"
        style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white"
            style={{ backgroundColor: t.accent }}
          >
            {initials}
          </span>
          <p className="min-w-0 break-words font-heading text-xl font-extrabold" style={{ color: t.fg }}>
            {user.name}
          </p>
        </div>

        <dl className="mt-5 space-y-4">
          <div>
            <dt className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
              HOME
            </dt>
            <dd className="mt-1 text-sm" style={{ color: t.fg }}>
              Unit {unit.unitNumber} · {unit.property.name}
              <span className="block" style={{ color: t.fgMuted }}>
                {unit.property.suburb}, {unit.property.city}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
              PHONE
            </dt>
            <dd className="mt-1 font-mono text-sm" style={{ color: user.phone ? t.fg : t.fgMuted }}>
              {user.phone ? formatZwPhone(user.phone) : "No number on file"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-4">
        <SmsToggle initial={user.smsOptIn} />
      </div>

      <div className="mt-4">
        <TenantSignOutButton />
      </div>
    </div>
  );
}
