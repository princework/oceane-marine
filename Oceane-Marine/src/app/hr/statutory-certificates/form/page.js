import { Suspense } from "react";
import HrSidebar from "../../components/HrSidebar";
import SideBarSkeleton from "../../components/SideBarSkeleton";
import StatutoryCertificatesFormPage from "./StatutoryCertificatesFormPage";

export default function StatutoryCertificatesFormPageWrapper() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <Suspense fallback={<SideBarSkeleton />}>
        <HrSidebar />
      </Suspense>

      {/* Main content */}
      <Suspense
        fallback={
          <div className="flex-1 min-w-0 flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        }
      >
        <div className="flex-1 min-w-0 transition-all duration-300 md:pl-72">
          <div className="mx-auto py-8 space-y-6 px-6">
            <StatutoryCertificatesFormPage />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
