import { Suspense } from "react";
import QhseSidebar from "../../../components/QhseSidebar";
import SideBarSkeleton from "../../../components/SideBarSkeleton";
import BaseAuditFormPage from "./BaseAuditFormPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function BaseAuditFormPageWrapper() {
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
        <BaseAuditFormPage />
      </Suspense>
    </div>
  );
}
