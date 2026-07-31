import { Suspense } from "react";
import TrainingPlanPage from "./TrainingPlanPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TrainingPlanPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <TrainingPlanPage />
      </Suspense>
  );
}
