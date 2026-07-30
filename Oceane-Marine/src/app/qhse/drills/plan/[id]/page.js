import { Suspense } from "react";
import QhseSidebar from "../../../components/QhseSidebar";
import SideBarSkeleton from "../../../components/SideBarSkeleton";
import DrillPlanReviewPage from "./DrillPlanReviewPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillPlanReviewPageWrapper() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>

      {/* Main content */}
      <Suspense fallback={<QhseSuspenseFallback />}>
        <DrillPlanReviewPage />
      </Suspense>
    </div>
  );
}
