import { LANDLORD_DARK } from "@/components/landlord/theme";

// Loading state for the landlord dashboard. It mirrors DashboardView's layout (same grids,
// paddings and block heights) so the real content replaces it without the page jumping.
// The pulse is skipped for people who ask for reduced motion.

const t = LANDLORD_DARK;
const BONE = "rgba(255,255,255,0.07)";

function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md motion-safe:animate-pulse ${className}`} style={{ backgroundColor: BONE }} />;
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl ${className}`}
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
    >
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-6xl p-6 sm:p-8">
      <span className="sr-only">Loading your dashboard…</span>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <Bone className="h-3 w-44" />
          <Bone className="mt-2 h-8 w-64 sm:h-9" />
        </div>
        <Bone className="h-8 w-36 rounded-full" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <Bone className="h-3 w-56" />
          <Bone className="mt-3 h-12 w-32" />
          <Bone className="mt-3 h-4 w-40" />
        </Card>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Bone className="h-2.5 w-20" />
              <Bone className="mt-2 h-7 w-16" />
              <Bone className="mt-2 h-3 w-24" />
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="flex min-h-11 items-center justify-between">
            <Bone className="h-5 w-28" />
            <Bone className="h-3 w-24" />
          </div>
          <Card className="mt-2 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex min-h-14 items-start justify-between gap-3 px-4 py-3"
                style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
              >
                <div>
                  <Bone className="h-4 w-40" />
                  <Bone className="mt-2 h-3 w-32" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Bone className="h-5 w-16 rounded-full" />
                  <Bone className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <div className="flex min-h-11 items-center justify-between">
            <Bone className="h-5 w-36" />
            <Bone className="h-3 w-20" />
          </div>
          <div className="mt-1 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className={`p-4 ${i >= 2 ? "hidden sm:block" : ""}`}>
                <Bone className="h-4 w-48" />
                <Bone className="mt-2 h-4 w-3/4" />
                <Bone className="mt-2 h-3 w-28" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
