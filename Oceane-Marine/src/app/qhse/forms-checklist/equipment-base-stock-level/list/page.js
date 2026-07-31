import { Suspense } from "react";
import EquipmentBaseStockListPage from "./EquipmentBaseStockListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function EquipmentBaseStockListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <EquipmentBaseStockListPage />
      </Suspense>
  );
}
