import { Suspense } from "react";
import VendorSupplyListClient from "./VendorSupplyListClient";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorSupplyListPage() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <VendorSupplyListClient />
      </Suspense>
  );
}
