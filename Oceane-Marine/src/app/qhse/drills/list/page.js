import { Suspense } from "react";
import QhseSidebar from "../../components/QhseSidebar";
import SideBarSkeleton from "../../components/SideBarSkeleton";
import DrillsListClient from "./DrillsListClient";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillsListPage() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>

      {/* Main Content */}
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DrillsListClient />
      </Suspense>
    </div>
  );
}
