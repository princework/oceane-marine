import { Suspense } from "react";
import PmsSidebar from "../../components/PmsSidebar";
import SideBarSkeleton from "../../components/SideBarSkeleton";
import CertificationsFormPage from "./CertificationsFormPage";

export default function CertificationsFormPageWrapper() {
    return (
        <div className="min-h-screen bg-transparent text-white flex">
            {/* Sidebar */}
            <Suspense fallback={<SideBarSkeleton />}>
                <PmsSidebar />
            </Suspense>

            {/* Main content */}
            <Suspense
                fallback={
                    <div className="flex-1 min-w-0 flex items-center justify-center">
                        <p className="text-white/60">
                            Loading certifications form page…
                        </p>
                    </div>
                }
            >
                <CertificationsFormPage />
            </Suspense>
        </div>
    );
}
