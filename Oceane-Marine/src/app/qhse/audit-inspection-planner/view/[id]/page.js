import { Suspense } from "react";
import AuditInspectionPlannerViewPage from "./AuditInspectionPlannerViewPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function AuditInspectionPlannerViewPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <AuditInspectionPlannerViewPage />
      </Suspense>
  );
}
