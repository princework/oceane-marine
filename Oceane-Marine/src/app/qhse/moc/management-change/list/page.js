import { Suspense } from "react";
import MOCManagementChangeListPage from "./MOCManagementChangeListPage.js";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function MOCManagementChangeListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <MOCManagementChangeListPage />
      </Suspense>
  );
}
