import { Suspense } from "react";
import DrillPlanReviewPage from "./DrillPlanReviewPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillPlanReviewPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <DrillPlanReviewPage />
      </Suspense>
  );
}
