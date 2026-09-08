"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";

export function GenerateRentButton({ periodMonth, periodYear }: { periodMonth: number; periodYear: number }) {
  const router = useRouter();
  const generate = trpc.rent.generateForPeriod.useMutation({
    onSuccess: (result) => {
      if (result.created === 0) {
        toast(
          result.ineligible > 0
            ? `No records created — ${result.ineligible} unit(s) have no USD rent amount set`
            : "No active tenancies to generate records for",
        );
      } else {
        toast.success(`Generated ${result.created} rent record${result.created === 1 ? "" : "s"}`);
      }
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Button
      type="button"
      onClick={() => generate.mutate({ periodMonth, periodYear })}
      disabled={generate.isPending}
      className="bg-brand-primary-dark hover:bg-brand-primary"
    >
      {generate.isPending ? "Generating…" : "Generate for this period"}
    </Button>
  );
}
