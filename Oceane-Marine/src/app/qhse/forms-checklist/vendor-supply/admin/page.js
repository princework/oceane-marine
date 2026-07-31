import { Suspense } from "react";
import VendorSupplyAdminPage from "./VendorSupplyAdminPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorSupplyAdminPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <VendorSupplyAdminPage />
      </Suspense>
  );
}
