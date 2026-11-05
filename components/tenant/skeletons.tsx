import { TENANT_DARK } from "@/components/tenant/theme";

// Loading states for the tenant portal, in the forest theme. Each mirrors its page's real layout
// (same container, paddings and block heights) so the content replaces it without the page
// jumping. The pulse is skipped for people who ask for reduced motion.

const t = TENANT_DARK;
const BONE = "rgba(255,255,255,0.07)";

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md motion-safe:animate-pulse ${className}`} style={{ backgroundColor: BONE }} />;
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className={`rounded-2xl ${className}`} style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      {children}
    </div>
  );
}

function Shell({ width, label, children }: { width: "max-w-3xl" | "max-w-2xl"; label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={`mx-auto ${width} p-6 sm:p-8`}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** The rent card: eyebrow and pill, amount with ZiG, due date, proof line, action. */
function RentCardSkeleton({ action }: { action: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <Bone className="h-3 w-32" />
        <Bone className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Bone className="h-10 w-36" />
        <Bone className="h-4 w-24" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Bone className="h-4 w-52" />
        <Bone className="h-5 w-20 rounded-full" />
      </div>
      <Bone className="mt-3 h-4 w-full max-w-xs" />
      {action && <Bone className="mt-4 h-11 w-full rounded-lg sm:w-44" />}
    </Card>
  );
}

function ComplaintRowSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-20" />
        <Bone className="h-3 w-10" />
      </div>
      <Bone className="mt-2 h-4 w-3/4" />
    </div>
  );
}

export function TenantHomeSkeleton() {
  return (
    <Shell width="max-w-3xl" label="Loading your home page…">
      <Bone className="h-3 w-48" />
      <Bone className="mt-2 h-8 w-56 sm:h-9" />
      <Bone className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6">
        <RentCardSkeleton action />
      </div>
      <div className="mt-6 flex min-h-11 items-center justify-between">
        <Bone className="h-5 w-36" />
        <Bone className="h-3 w-20" />
      </div>
      <div className="mt-3 space-y-2.5">
        <ComplaintRowSkeleton />
        <ComplaintRowSkeleton />
      </div>
      <Bone className="mt-4 h-12 w-full rounded-lg" />
    </Shell>
  );
}

export function TenantRentSkeleton() {
  return (
    <Shell width="max-w-2xl" label="Loading your rent…">
      <Bone className="h-8 w-20 sm:h-9" />
      <div className="mt-6">
        <RentCardSkeleton action={false} />
      </div>
      <Card className="mt-4 p-5">
        <Bone className="h-5 w-44" />
        <Bone className="mt-4 h-3 w-32" />
        <div className="mt-2 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-11 w-24 rounded-full" />
          ))}
        </div>
        <Bone className="mt-4 h-3 w-36" />
        <Bone className="mt-2 h-11 w-full rounded-lg" />
        <Bone className="mt-4 h-28 w-full rounded-2xl" />
        <Bone className="mt-4 h-12 w-full rounded-lg" />
      </Card>
      <Bone className="mt-6 h-6 w-40" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex min-h-14 items-center justify-between px-4 py-3">
            <div>
              <Bone className="h-4 w-28" />
              <Bone className="mt-1.5 h-4 w-14 rounded-full" />
            </div>
            <Bone className="h-4 w-20" />
          </Card>
        ))}
      </div>
    </Shell>
  );
}

export function TenantComplaintsSkeleton() {
  return (
    <Shell width="max-w-3xl" label="Loading your complaints…">
      <div className="flex items-center justify-between">
        <Bone className="h-8 w-40 sm:h-9" />
        <Bone className="h-11 w-28 rounded-lg" />
      </div>
      <div className="mt-6 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="rounded-2xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-20" />
              <Bone className="h-3 w-12" />
            </div>
            <Bone className="mt-2 h-4 w-3/5" />
            <Bone className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function TenantProfileSkeleton() {
  return (
    <Shell width="max-w-2xl" label="Loading your profile…">
      <Bone className="h-8 w-28 sm:h-9" />
      <Card className="mt-6 p-5">
        <div className="flex items-center gap-4">
          <Bone className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Bone className="h-5 w-40" />
            <Bone className="mt-2 h-4 w-56 max-w-full" />
          </div>
        </div>
        <Bone className="mt-5 h-3 w-16" />
        <Bone className="mt-2 h-5 w-36" />
      </Card>
      <Card className="mt-4 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <Bone className="h-5 w-40" />
          <Bone className="mt-2 h-4 w-full max-w-xs" />
        </div>
        <Bone className="h-7 w-12 shrink-0 rounded-full" />
      </Card>
      <Bone className="mt-4 h-11 w-full rounded-lg sm:w-40" />
    </Shell>
  );
}

/** Fallback for any tenant route without its own loading.tsx: a title and two cards. */
export function TenantPageSkeleton() {
  return (
    <Shell width="max-w-3xl" label="Loading…">
      <Bone className="h-8 w-48 sm:h-9" />
      <div className="mt-6 space-y-4">
        <RentCardSkeleton action={false} />
        <ComplaintRowSkeleton />
      </div>
    </Shell>
  );
}
