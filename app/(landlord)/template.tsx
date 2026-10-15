// Unlike a layout, a template is re-created on every navigation between the pages it wraps, so
// this plays the 200ms fade-and-rise (CLAUDE.md § Design System) each time the landlord moves
// to another page while the sidebar and tab bar stay put. It is CSS on a server component on
// purpose: it runs at first paint without waiting for JavaScript, which matters on a slow link.
export default function LandlordTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
