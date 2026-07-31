import { Suspense } from "react";
import TrainingRecordPage from "./TrainingRecordPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TrainingRecordPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <TrainingRecordPage />
      </Suspense>
  );
}
