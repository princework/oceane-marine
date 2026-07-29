import { Suspense } from "react";
import QhseSidebar from "../../../components/QhseSidebar";
import VendorSupplyListClient from "./VendorSupplyListClient";
import SideBarSkeleton from "../../../components/SideBarSkeleton";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorSupplyListPage() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>

      {/* Page Content */}
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <VendorSupplyListClient />
      </Suspense>
    </div>
  );
}
