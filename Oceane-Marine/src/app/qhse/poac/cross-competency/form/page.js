import { Suspense } from "react";
import PoacCrossCompetencyFormPage from "./PoacCrossCompetencyFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function PoacCrossCompetencyFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <PoacCrossCompetencyFormPage />
      </Suspense>
  );
}
