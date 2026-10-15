import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getComplaintsForOrg } from "@/lib/db/scoped";
import { ACTIVE_STATUSES } from "@/lib/complaint-queue";
import { ComplaintQueue, ComplaintQueueSkeleton } from "@/components/landlord/complaint-queue";

// The first page of what needs the landlord now (open, in progress, pending parts), most urgent
// first. Resolved complaints are a separate feed the queue fetches when asked, so they can never
// push an open complaint off this page. It sits in its own Suspense boundary so the queue's
// skeleton paints while it loads instead of the whole screen waiting on it.
async function Queue() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const firstPage = await getComplaintsForOrg(user.orgId!, { statuses: ACTIVE_STATUSES });
  return <ComplaintQueue firstPage={firstPage} />;
}

// The shell has a fixed height so the queue and the thread scroll inside it and the reply box
// stays put. On a phone the page sits between the 56px top bar and the 64px tab bar (7.5rem).
export default function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh_-_7.5rem)] sm:h-dvh">
      <Suspense fallback={<ComplaintQueueSkeleton />}>
        <Queue />
      </Suspense>
      <div className="h-full min-w-0 flex-1">{children}</div>
    </div>
  );
}
