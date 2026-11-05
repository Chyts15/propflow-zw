"use client"; // Error boundaries must be Client Components

import { ErrorPanel } from "@/components/shared/error-panel";

// Catches a failure while the complaints screen loads a thread. This boundary sits below the
// complaints layout, so the queue stays on screen and usable while the thread pane shows the
// panel. Without it the whole screen, queue included, would be replaced by the landlord-wide one.
export default function ComplaintsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} homeHref="/complaints" homeLabel="BACK TO COMPLAINTS" />;
}
