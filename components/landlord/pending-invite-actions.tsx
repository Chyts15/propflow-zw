"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { RotateCw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { friendlyMessage } from "@/lib/trpc-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  BTN_SECONDARY,
  BTN_TRIGGER,
  DIALOG_CONTENT,
  DIALOG_FOOTER,
  DialogTitleBlock,
  FormError,
} from "@/components/landlord/dialog-kit";

export type PendingInviteSummary = { id: string; name: string; email: string; unitLabel: string };

/** Resend and cancel for an invitation the tenant hasn't accepted yet. */
export function PendingInviteActions({ invite }: { invite: PendingInviteSummary }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const resend = trpc.tenants.resendInvite.useMutation({
    onSuccess: () => {
      toast.success(`Invitation emailed again to ${invite.name}`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(friendlyMessage(err));
      // Cancelled or accepted elsewhere since this page loaded: show the current state.
      if (err.data?.code === "NOT_FOUND") router.refresh();
    },
  });

  const cancel = trpc.tenants.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success(`Invitation to ${invite.name} cancelled`);
      setConfirmOpen(false);
      router.refresh();
    },
    onError: (err) => {
      setCancelError(friendlyMessage(err));
      if (err.data?.code === "NOT_FOUND") router.refresh();
    },
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={resend.isPending}
          className={`${BTN_TRIGGER} flex-1 sm:flex-none`}
          onClick={() => resend.mutate({ invitationId: invite.id })}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {resend.isPending ? "SENDING…" : "RESEND"}
          <span className="sr-only"> invitation to {invite.name}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`${BTN_SECONDARY} flex-1 sm:flex-none`}
          onClick={() => {
            setCancelError(null);
            setConfirmOpen(true);
          }}
        >
          CANCEL INVITE
          <span className="sr-only"> for {invite.name}</span>
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false} className={DIALOG_CONTENT}>
          <DialogTitleBlock
            title="Cancel this invitation?"
            description={`The link emailed to ${invite.email} will stop working. ${invite.unitLabel} stays vacant, and you can invite someone else.`}
          />
          <FormError message={cancelError} />
          <DialogFooter className={DIALOG_FOOTER}>
            <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => setConfirmOpen(false)}>
              Keep invitation
            </Button>
            <Button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ invitationId: invite.id })}
              className="press h-11 rounded-2xl border-transparent bg-[rgba(220,38,38,0.2)] px-5 font-mono text-xs font-medium tracking-wide text-[#f87171] hover:bg-[rgba(220,38,38,0.3)] disabled:opacity-60"
            >
              {cancel.isPending ? "Cancelling…" : "Cancel invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
