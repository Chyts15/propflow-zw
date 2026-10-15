import { TenantPageSkeleton } from "@/components/tenant/skeletons";

// Fallback while any tenant page without its own loading.tsx fetches (Next wraps page.tsx in
// Suspense with this). Home, Rent, Complaints and Profile each have a skeleton shaped like the
// real page. The tenant layout runs its own queries first, and loading.tsx does not cover the
// layout, so the very first load still waits on the layout before a skeleton appears.
export default function Loading() {
  return <TenantPageSkeleton />;
}
