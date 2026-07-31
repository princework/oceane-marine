import { Suspense } from "react";
import AuditorRegisterPage from "./AuditorRegisterPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function AuditorRegisterPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <AuditorRegisterPage />
      </Suspense>
  );
}
