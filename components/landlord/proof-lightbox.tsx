"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FOCUS_RING } from "@/components/landlord/theme";

export function ProofBadge({
  proofImageUrl,
  style,
  label = "Proof uploaded",
  dialogTitle = "Payment proof",
  size = "compact",
}: {
  proofImageUrl: string;
  style?: React.CSSProperties;
  label?: string;
  dialogTitle?: string;
  /** "compact" suits a dense table row; "comfortable" is a 44px touch target for a phone. */
  size?: "compact" | "comfortable";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`press flex items-center rounded-full font-medium ${FOCUS_RING} ${
          size === "comfortable" ? "min-h-11 gap-1.5 px-3.5 text-xs" : "gap-1 px-2 py-0.5 text-[11px]"
        }`}
        style={style}
      >
        <ImageIcon aria-hidden="true" className={size === "comfortable" ? "h-4 w-4" : "h-3 w-3"} /> {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative h-96 w-full overflow-hidden rounded-lg bg-black/5">
            <Image
              src={proofImageUrl}
              alt={label === "Proof uploaded" ? dialogTitle : `${dialogTitle}: ${label}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
