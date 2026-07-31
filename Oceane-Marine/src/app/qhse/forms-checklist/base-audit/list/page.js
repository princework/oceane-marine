import { Suspense } from "react";
import BaseAuditListPage from "./BaseAuditListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function BaseAuditListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <BaseAuditListPage />
      </Suspense>
  );
}
