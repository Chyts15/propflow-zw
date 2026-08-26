// Zimbabwe locale: always show USD alongside ZiG when both are known.
// "$1,200 USD" and "ZiG 15,000" — never USD-only when a ZiG figure exists.

function formatUsd(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
}

function formatZig(amount: number) {
  return `ZiG ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CurrencyDisplay({ usd, zig }: { usd: number; zig?: number | null }) {
  return (
    <span className="font-mono">
      {formatUsd(usd)}
      {zig != null && <span style={{ color: "rgba(255,255,255,0.4)" }}> · {formatZig(zig)}</span>}
    </span>
  );
}
