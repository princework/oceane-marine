import { Suspense } from "react";
import DefectCreatePage from "./DefectCreatePage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DefectCreatePageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DefectCreatePage />
      </Suspense>
  );
}
