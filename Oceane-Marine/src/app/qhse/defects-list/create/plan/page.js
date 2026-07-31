import { Suspense } from "react";
import DefectPlanPage from "./DefectPlanPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DefectPlanPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DefectPlanPage />
      </Suspense>
  );
}
