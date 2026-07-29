import { Suspense } from "react";
import PmsSidebar from "../components/PmsSidebar";
import SideBarSkeleton from "../components/SideBarSkeleton";
import PmsLocationRouteClient from "./PmsLocationRouteClient";

export default function PmsLocationPage() {
  return (
    <div className="flex min-h-screen bg-transparent text-white">
      <Suspense fallback={<SideBarSkeleton />}>
        <PmsSidebar />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-white/60">
            Loading…
          </div>
        }
      >
        <PmsLocationRouteClient />
      </Suspense>
    </div>
  );
}
