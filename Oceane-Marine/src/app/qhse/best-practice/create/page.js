import { Suspense } from "react";
import BestPracticeCreatePage from "./BestPracticeCreatePage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function BestPracticeCreatePageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <BestPracticeCreatePage />
      </Suspense>
  );
}
