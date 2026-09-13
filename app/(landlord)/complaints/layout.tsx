import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getComplaintsForOrg } from "@/lib/db/scoped";
import { ComplaintQueue } from "@/components/landlord/complaint-queue";

export default async function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const { items: complaints } = await getComplaintsForOrg(user.orgId!);

  return (
    <div className="flex h-full min-h-screen">
      <ComplaintQueue complaints={complaints} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
