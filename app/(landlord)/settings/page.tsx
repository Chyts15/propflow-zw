import { redirect } from "next/navigation";

// Billing is the only settings sub-page built so far — settings/sms lands
// alongside Step 7 once Africa's Talking is off hold.
export default function SettingsPage() {
  redirect("/settings/billing");
}
