"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProofBadge({ proofImageUrl, style }: { proofImageUrl: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={style}
      >
        <ImageIcon className="h-3 w-3" /> Proof uploaded
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment proof</DialogTitle>
          </DialogHeader>
          <div className="relative h-96 w-full overflow-hidden rounded-lg bg-black/5">
            <Image src={proofImageUrl} alt="Payment proof" fill className="object-contain" unoptimized />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
