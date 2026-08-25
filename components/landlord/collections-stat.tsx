// The hero retention metric — spec: "make it prominent."

export function CollectionsStat({ pct }: { pct: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-stone-600">On-time collections this month</p>
      <p className="font-heading mt-1 text-5xl font-extrabold text-stone-900">{pct}%</p>
    </div>
  );
}
