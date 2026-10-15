import { LANDLORD_DARK } from "@/components/landlord/theme";

// Loading state for the Properties, Property and Tenants pages. It uses the same container, header
// row and card sizes as the pages themselves so the content replaces it without the page jumping,
// and the pulse is skipped for people who ask for reduced motion.

const t = LANDLORD_DARK;
const BONE = "rgba(255,255,255,0.07)";

function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md motion-safe:animate-pulse ${className}`} style={{ backgroundColor: BONE }} />;
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className={`rounded-2xl ${className}`} style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      {children}
    </div>
  );
}

export function ListPageSkeleton({ layout, label }: { layout: "cards" | "rows"; label: string }) {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-6xl p-6 sm:p-8">
      <span className="sr-only">{label}</span>

      <div className="flex items-center justify-between gap-4">
        <Bone className="h-8 w-40 sm:h-9" />
        <Bone className="h-11 w-24 rounded-2xl sm:w-40" />
      </div>

      {layout === "cards" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Bone className="h-10 w-10 rounded-lg" />
              <Bone className="mt-4 h-5 w-2/3" />
              <Bone className="mt-2 h-4 w-1/2" />
              <Bone className="mt-4 h-3 w-full" />
              <Bone className="mt-2 h-1.5 w-full rounded-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-4 sm:p-5">
              <Bone className="h-4 w-40" />
              <Bone className="mt-2 h-3 w-64 max-w-full" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
