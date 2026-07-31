import { Suspense } from "react";
import HseInductionChecklistListPage from "./HseInductionChecklistListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function HseInductionChecklistListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <HseInductionChecklistListPage />
      </Suspense>
  );
}
