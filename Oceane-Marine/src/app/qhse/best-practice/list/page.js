import { Suspense } from "react";
import BestPracticeListPage from "./BestPracticeListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function BestPracticeListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <BestPracticeListPage />
      </Suspense>
  );
}
