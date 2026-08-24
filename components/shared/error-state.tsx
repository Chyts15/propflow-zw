"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="rounded-full bg-danger/10 p-3">
        <AlertTriangle className="h-6 w-6 text-danger" />
      </div>
      <div>
        <p className="font-heading text-lg font-extrabold text-stone-900">{title}</p>
        <p className="mt-1 text-sm text-stone-600">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

function OfflineState({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-600",
        className,
      )}
    >
      <WifiOff className="h-4 w-4" />
      Connection is slow — hang tight, we&apos;ll keep trying.
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center",
        className,
      )}
    >
      <p className="font-heading text-lg font-extrabold text-stone-900">{title}</p>
      {description && <p className="text-sm text-stone-600">{description}</p>}
      {action}
    </div>
  );
}

export { ErrorState, OfflineState, EmptyState };
