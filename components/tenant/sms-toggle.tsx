"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { tenantErrorMessage } from "@/lib/tenant-errors";
import { TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";

// The tenant's SMS choice. This toggle is the authoritative opt-out (CLAUDE.md § Africa-First):
// sendSms reads User.smsOptIn at send time. SMS alerts are not switched on yet, so the copy says the
// choice is saved for when they are, rather than promising a text that will not arrive.

export function SmsToggle({ initial }: { initial: boolean }) {
  const t = TENANT_DARK;
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const save = trpc.tenantProfile.setSmsOptIn.useMutation({
    onError: (err, vars) => {
      // Optimistic: the switch already moved, so put it back and say why.
      setOn(!vars.smsOptIn);
      const message = tenantErrorMessage(err, "We couldn't save that. Please try again.");
      setError(message);
      toast.error(message);
    },
    onSuccess: () => setError(null),
  });

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    save.mutate({ smsOptIn: next });
  }

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="sms-label" className="font-heading text-base font-extrabold" style={{ color: t.fg }}>
            Text message alerts
          </p>
          <p id="sms-hint" className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            {on
              ? "Allowed. PropFlow may text you about rent and complaints once SMS is live."
              : "Off. PropFlow won't text you, even once SMS is live."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="sms-label"
          aria-describedby="sms-hint sms-note"
          onClick={toggle}
          className={`press relative -my-2 -mr-2 flex h-11 w-[68px] shrink-0 items-center justify-center rounded-full ${TENANT_FOCUS_RING}`}
        >
          <span
            className="relative block h-7 w-12 rounded-full transition-colors duration-200 motion-reduce:transition-none"
            style={{ backgroundColor: on ? t.accentLight : "rgba(255,255,255,0.18)" }}
          >
            <span
              className="absolute left-0.5 top-0.5 block h-6 w-6 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none"
              style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
            />
          </span>
        </button>
      </div>

      <p id="sms-note" className="mt-3 text-xs" style={{ color: t.fgMuted }}>
        SMS alerts aren&apos;t switched on yet, so nothing is being sent today. Your choice is saved now and PropFlow will follow it
        when they start.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </div>
  );
}
