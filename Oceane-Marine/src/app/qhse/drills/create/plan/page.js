import DrillsPlanClient from "./DrillPlanClient";
import { Suspense } from "react";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillsPlanPage() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DrillsPlanClient />
      </Suspense>
  );
}
