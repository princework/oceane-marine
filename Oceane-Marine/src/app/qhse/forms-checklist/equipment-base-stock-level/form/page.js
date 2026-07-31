import { Suspense } from "react";
import EquipmentBaseStockFormPage from "./EquipmentBaseStockFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function EquipmentBaseStockFormPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <EquipmentBaseStockFormPage />
      </Suspense>
  );
}
