import { Suspense } from "react";
import MOCManagementChangeFormPage from "./MOCManagementChangeFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function MOCManagementChangeFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <MOCManagementChangeFormPage />
      </Suspense>
  );
}
