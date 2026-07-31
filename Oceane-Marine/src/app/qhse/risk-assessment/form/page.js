import { Suspense } from "react";
import RiskAssessmentFormPage from "./RiskAssessmentFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function RiskAssessmentFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <RiskAssessmentFormPage />
      </Suspense>
  );
}
