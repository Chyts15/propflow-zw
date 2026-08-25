import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { clerkId: userId! },
    include: { organization: true },
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl text-stone-900">Good morning, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-stone-600">{user.organization?.name}</p>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-stone-600">
          Signed in as <span className="font-mono text-stone-900">{user.email}</span> · role{" "}
          <span className="font-mono text-stone-900">{user.role}</span> · tier{" "}
          <span className="font-mono text-stone-900">{user.organization?.tier}</span>
        </p>
        <p className="mt-3 text-sm text-stone-600">
          The real dashboard (rent ledger, complaints, on-time collections) is Step 4 — this
          confirms Clerk → webhook → Postgres → role-gated route is wired correctly.
        </p>
      </div>
    </main>
  );
}
