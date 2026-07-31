import { Suspense } from "react";
import DrillReportClient from "./DrillsReportClient";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillReportPage() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DrillReportClient />
      </Suspense>
  );
}
