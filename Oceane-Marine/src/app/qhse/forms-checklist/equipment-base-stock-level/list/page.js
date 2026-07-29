import { Suspense } from "react";
import QhseSidebar from "../../../components/QhseSidebar";
import SideBarSkeleton from "../../../components/SideBarSkeleton";
import EquipmentBaseStockListPage from "./EquipmentBaseStockListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function EquipmentBaseStockListPageWrapper() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>

      {/* Main content */}
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <EquipmentBaseStockListPage />
      </Suspense>
    </div>
  );
}
