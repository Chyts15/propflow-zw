import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  // Clerk-level auth is UX, not the security boundary (CLAUDE.md § Security
  // First) — this DB check is what actually enforces the role, every time.
  if (!user || user.role !== "LANDLORD") redirect("/home");

  return <div className="min-h-screen bg-stone-50">{children}</div>;
}
