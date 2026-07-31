import { Suspense } from "react";
import AuditSubContractorListAdminPage from "./AuditSubContractorListAdminPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function AuditSubContractorListAdminPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <AuditSubContractorListAdminPage />
      </Suspense>
  );
}
