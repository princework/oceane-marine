import { Suspense } from "react";
import PoacCrossCompetencyViewPage from "./PoacCrossCompetencyViewPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function PoacCrossCompetencyViewPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <PoacCrossCompetencyViewPage />
      </Suspense>
  );
}
