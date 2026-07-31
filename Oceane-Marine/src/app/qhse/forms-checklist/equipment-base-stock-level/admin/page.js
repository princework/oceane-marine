import { Suspense } from "react";
import EquipmentBaseStockAdminPage from "./EquipmentBaseStockAdminPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function EquipmentBaseStockAdminPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <EquipmentBaseStockAdminPage />
      </Suspense>
  );
}
