import { ComplaintThreadSkeleton } from "@/components/landlord/complaint-thread";

// Shown in the thread pane while a complaint loads; the queue beside it stays put. The queue has
// its own skeleton (see layout.tsx), so the screen paints in two independent parts.
export default function Loading() {
  return <ComplaintThreadSkeleton />;
}
