import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getComplaintsForTenant } from "@/lib/db/scoped";
import { TENANT_DARK, TENANT_FOCUS_RING, COMPLAINT_STATUS_TONE } from "@/components/tenant/theme";
import { formatRelativeTime } from "@/lib/utils";
import { COMPLAINT_STATUS_LABEL } from "@/lib/tenant-rent-view";
import { previewText, replyLabel } from "@/lib/tenant-complaint-view";

export default async function TenantComplaintsPage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const { items: complaints } = await getComplaintsForTenant(user.id);
  const t = TENANT_DARK;

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Complaints
        </h1>
        <Link
          href="/my-complaints/new"
          className={`press flex min-h-11 items-center gap-1.5 rounded-lg px-4 font-mono text-xs font-medium text-white ${TENANT_FOCUS_RING}`}
          style={{ backgroundColor: t.accent }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> REPORT
        </Link>
      </div>

      {complaints.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No complaints yet
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Report an issue and you can follow it here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2.5">
          {complaints.map((c) => {
            const latest = c.messages[0];
            const replies = replyLabel(c._count.messages);
            return (
              <Link
                key={c.id}
                href={`/my-complaints/${c.id}`}
                className={`press block rounded-2xl p-4 ${TENANT_FOCUS_RING}`}
                style={{ backgroundColor: COMPLAINT_STATUS_TONE[c.status] }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{COMPLAINT_STATUS_LABEL[c.status] ?? "Open"}</p>
                  <span className="text-xs text-white/80">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm font-medium text-white">{c.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{c.description}</p>
                {latest && replies && (
                  <div className="mt-3 rounded-xl bg-black/25 px-3 py-2">
                    <p className="text-xs font-medium text-white">{replies}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{previewText(latest.body)}</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
