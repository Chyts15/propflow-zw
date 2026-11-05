import { DashboardSkeleton } from "@/components/landlord/dashboard-skeleton";

// Shown while the dashboard's data loads (Next wraps page.tsx in Suspense with this).
// Note: the landlord layout runs its own queries first, and loading.tsx does not cover
// the layout, so the very first load still waits on the layout before this appears.
export default function Loading() {
  return <DashboardSkeleton />;
}
