export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      {children}
    </main>
  );
}
