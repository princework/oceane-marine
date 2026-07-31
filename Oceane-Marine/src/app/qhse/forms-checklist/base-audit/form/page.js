import { Suspense } from "react";
import BaseAuditFormPage from "./BaseAuditFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function BaseAuditFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <BaseAuditFormPage />
      </Suspense>
  );
}
