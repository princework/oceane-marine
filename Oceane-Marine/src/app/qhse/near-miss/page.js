import { Suspense } from "react";
import NearMissListPage from "./NearMissListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function NearMissListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <NearMissListPage />
      </Suspense>
  );
}
