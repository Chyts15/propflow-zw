// See app/(landlord)/template.tsx: a 200ms fade-and-rise on each page change inside the shell,
// in CSS so it runs at first paint without waiting for JavaScript.
export default function TenantTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
