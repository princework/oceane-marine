import { Suspense } from "react";
import VendorRegisterPage from "./VendorRegisterPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorRegisterPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <VendorRegisterPage />
      </Suspense>
  );
}
