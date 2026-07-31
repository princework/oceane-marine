import { Suspense } from "react";
import NewBaseSetupChecklistFormPage from "./NewBaseSetupChecklistFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function NewBaseSetupChecklistFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <NewBaseSetupChecklistFormPage />
      </Suspense>
  );
}
