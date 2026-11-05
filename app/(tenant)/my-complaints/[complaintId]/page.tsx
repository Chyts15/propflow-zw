import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getComplaintForTenant } from "@/lib/db/scoped";
import { TENANT_DARK, TENANT_FOCUS_RING, COMPLAINT_STATUS_TONE } from "@/components/tenant/theme";
import { COMPLAINT_STATUS_LABEL } from "@/lib/tenant-rent-view";
import { senderLabel } from "@/lib/tenant-complaint-view";
import { formatClock } from "@/lib/complaint-thread";
import { formatLongDate } from "@/lib/dates";

// A tenant's own complaint with the replies their landlord has sent. Read-only: the tenant files a
// complaint and follows it here. Like every tenant read, it does not depend on the landlord's billing.
export default async function TenantComplaintPage({ params }: { params: Promise<{ complaintId: string }> }) {
  const { complaintId } = await params;
  if (!z.string().cuid().safeParse(complaintId).success) notFound();

  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const t = TENANT_DARK;

  let complaint;
  try {
    complaint = await getComplaintForTenant(user.id, complaintId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const closed = complaint.status === "RESOLVED" || complaint.status === "CLOSED";

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <Link
        href="/my-complaints"
        className={`press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm ${TENANT_FOCUS_RING}`}
        style={{ color: t.fgMuted }}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Complaints
      </Link>

      <div className="mt-2 rounded-2xl p-4 sm:p-5" style={{ backgroundColor: COMPLAINT_STATUS_TONE[complaint.status] }}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-white">{COMPLAINT_STATUS_LABEL[complaint.status] ?? "Open"}</p>
          <p className="text-right text-xs text-white/80">Sent {formatLongDate(complaint.createdAt)}</p>
        </div>
        <h1 className="mt-2 font-heading text-xl font-extrabold text-white sm:text-2xl">{complaint.title}</h1>
        <p className="mt-1.5 whitespace-pre-line text-sm text-white/85">{complaint.description}</p>
        {closed && complaint.resolvedAt && (
          <p className="mt-3 text-xs text-white/80">
            {complaint.status === "RESOLVED" ? "Resolved" : "Closed"} on {formatLongDate(complaint.resolvedAt)}
          </p>
        )}
      </div>

      <h2 className="mt-8 font-heading text-lg font-extrabold" style={{ color: t.fg }}>
        Replies
      </h2>

      {complaint.messages.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-base font-extrabold" style={{ color: t.fg }}>
            No reply yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: t.fgMuted }}>
            Your landlord can see this complaint. Their reply will show here, so check back later.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {complaint.messages.map((m) => {
            const mine = m.senderRole === "TENANT";
            return (
              <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className="max-w-[88%] rounded-2xl px-4 py-3"
                  style={{ backgroundColor: mine ? t.accent : t.cardBg, border: mine ? undefined : `1px solid ${t.cardBorder}` }}
                >
                  <p className="text-xs font-medium" style={{ color: mine ? "rgba(255,255,255,0.85)" : t.accentLight }}>
                    {senderLabel(m.senderRole)}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-white">{m.body}</p>
                  <p className="mt-1.5 text-xs text-white/70">
                    {formatLongDate(m.createdAt)} at {formatClock(m.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
