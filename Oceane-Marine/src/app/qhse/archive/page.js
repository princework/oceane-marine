import ArchivePage from "./ArchivePage";
import { Suspense } from "react";
import QhseSidebar from "../components/QhseSidebar";
import SideBarSkeleton from "../components/SideBarSkeleton";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";

export default function ArchiveRoute() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <ArchivePage />
      </Suspense>
    </div>
  );
}
