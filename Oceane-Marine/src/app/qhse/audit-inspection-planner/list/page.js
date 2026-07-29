import { redirect } from "next/navigation";

/** List UI removed — planner is edited only from the year-based form. */
export default function AuditInspectionPlannerListRedirectPage() {
  redirect("/qhse/audit-inspection-planner/form");
}
