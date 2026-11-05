import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getComplaintForOrg } from "@/lib/db/scoped";
import { ComplaintThread } from "@/components/landlord/complaint-thread";

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ complaintId: string }>;
}) {
  const { complaintId } = await params;
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);

  let complaint;
  try {
    complaint = await getComplaintForOrg(user.orgId!, complaintId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  // Keyed by complaint so the reply draft and any unconfirmed change never follow the landlord
  // from one complaint to the next.
  return <ComplaintThread key={complaint.id} complaint={complaint} viewerName={user.name} />;
}
