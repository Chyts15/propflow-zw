import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { getComplaintForOrg } from "@/lib/db/scoped";
import { ComplaintThread } from "@/components/landlord/complaint-thread";

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ complaintId: string }>;
}) {
  const { complaintId } = await params;
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });

  let complaint;
  try {
    complaint = await getComplaintForOrg(user.orgId!, complaintId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return <ComplaintThread complaint={complaint} />;
}
