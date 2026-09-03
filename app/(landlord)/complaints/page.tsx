import { MessageSquareText } from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default function ComplaintsIndexPage() {
  const t = LANDLORD_DARK;
  return (
    <div className="hidden h-full min-h-screen flex-col items-center justify-center gap-2 sm:flex">
      <MessageSquareText className="h-8 w-8" style={{ color: t.fgFaint }} />
      <p className="text-sm" style={{ color: t.fgMuted }}>
        Select a complaint to view the thread
      </p>
    </div>
  );
}
