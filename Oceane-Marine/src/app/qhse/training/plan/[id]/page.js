import { Suspense } from "react";
import TrainingPlanReviewPage from "./TrainingPlanReviewPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TrainingPlanReviewPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <TrainingPlanReviewPage />
      </Suspense>
  );
}
