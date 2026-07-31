import { Suspense } from "react";
import TransferAuditListPage from "./TransferAuditListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TransferAuditListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <TransferAuditListPage />
      </Suspense>
  );
}
