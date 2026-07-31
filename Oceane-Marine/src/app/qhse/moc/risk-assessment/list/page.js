import { Suspense } from "react";
import RiskAssessmentListPage from "./RiskAssessmentListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function RiskAssessmentListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <RiskAssessmentListPage />
      </Suspense>
  );
}
