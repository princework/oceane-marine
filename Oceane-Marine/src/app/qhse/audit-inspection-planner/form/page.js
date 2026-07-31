import { Suspense } from "react";
import AuditInspectionPlannerFormPage from "./AuditInspectionPlannerFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function AuditInspectionPlannerFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <AuditInspectionPlannerFormPage />
      </Suspense>
  );
}
