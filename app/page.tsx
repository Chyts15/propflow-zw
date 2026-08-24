import { CardSkeleton } from "@/components/shared/skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-stone-50 p-8">
      <div className="text-center">
        <h1 className="text-4xl text-stone-900">PropFlow Zimbabwe</h1>
        <p className="mt-2 text-lg text-stone-600">
          PropFlow gets your rent paid on time.
        </p>
        <p className="mt-1 font-mono text-xs text-stone-400">
          Phase 1 scaffold — design system smoke test
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <a
          href="#"
          className="rounded-2xl bg-brand-primary-dark p-6 text-white shadow-sm transition hover:brightness-110"
        >
          <Badge className="bg-white/15 text-white">Landlord</Badge>
          <p className="mt-3 font-heading text-2xl font-extrabold">
            Landlord Portal
          </p>
          <p className="mt-1 text-sm text-white/80">
            Rent ledger, complaints, SMS reminders
          </p>
        </a>
        <a
          href="#"
          className="rounded-2xl bg-brand-secondary-dark p-6 text-white shadow-sm transition hover:brightness-110"
        >
          <Badge className="bg-white/15 text-white">Tenant</Badge>
          <p className="mt-3 font-heading text-2xl font-extrabold">
            Tenant Portal
          </p>
          <p className="mt-1 text-sm text-white/80">
            Rent status, proof upload, complaints
          </p>
        </a>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <ErrorState
          title="Design system check"
          description="Cards, skeletons, and error states render with the PropFlow palette."
        />
      </div>
    </main>
  );
}
