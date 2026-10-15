import { MessageSquareText } from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

// The right-hand pane before anything is picked. Phones never see it: there the queue fills the
// screen and the thread opens on its own page.
export default function ComplaintsIndexPage() {
  const t = LANDLORD_DARK;
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-2 px-6 text-center sm:flex">
      <MessageSquareText aria-hidden="true" className="h-8 w-8" style={{ color: t.fgMuted }} />
      <p className="text-sm" style={{ color: t.fgMuted }}>
        Pick a complaint from the list to read the thread and reply.
      </p>
    </div>
  );
}
