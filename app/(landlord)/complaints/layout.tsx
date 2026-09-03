import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getComplaintsForOrg } from "@/lib/db/scoped";
import { ComplaintQueue } from "@/components/landlord/complaint-queue";

export default async function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const { items: complaints } = await getComplaintsForOrg(user.orgId!);

  return (
    <div className="flex h-full min-h-screen">
      <ComplaintQueue complaints={complaints} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
