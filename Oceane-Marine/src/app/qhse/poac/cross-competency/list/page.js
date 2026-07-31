import { Suspense } from "react";
import PoacCrossCompetencyListPage from "./PoacCrossCompetencyListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function PoacCrossCompetencyListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <PoacCrossCompetencyListPage />
      </Suspense>
  );
}
