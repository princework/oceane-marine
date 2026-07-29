import { redirect } from "next/navigation";

// Single QHSE dashboard lives on the main app dashboard (QHSE tab). Redirect there.
export default function QhseDashboardPage() {
  redirect("/dashboard?tab=qhse");
}
