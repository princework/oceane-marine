import TargetKpiListPage from "./TargetKpiListPage";
import { Suspense } from "react";
import QhseSidebar from "@/app/qhse/components/QhseSidebar";
import SideBarSkeleton from "@/app/qhse/components/SideBarSkeleton";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TargetKpiListRoute() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <TargetKpiListPage />
      </Suspense>
    </div>
  );
}
