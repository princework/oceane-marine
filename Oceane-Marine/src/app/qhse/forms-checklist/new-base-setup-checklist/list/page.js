import { Suspense } from "react";
import NewBaseSetupChecklistListPage from "./NewBaseSetupChecklistListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function NewBaseSetupChecklistListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <NewBaseSetupChecklistListPage />
      </Suspense>
  );
}
