import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export default async function TenantHomePage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! } });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl text-stone-900">Welcome, {user.name.split(" ")[0]}</h1>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-stone-600">
          Signed in as <span className="font-mono text-stone-900">{user.email}</span> · role{" "}
          <span className="font-mono text-stone-900">{user.role}</span>
        </p>
        <p className="mt-3 text-sm text-stone-600">
          The real tenant home (rent status, complaints) is Step 4/8 — tenant accounts don&apos;t
          self-register yet, they arrive via landlord invitation (also Step 4).
        </p>
      </div>
    </main>
  );
}
