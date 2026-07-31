import { Suspense } from "react";
import DefectListPage from "./DefectListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DefectListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DefectListPage />
      </Suspense>
  );
}
