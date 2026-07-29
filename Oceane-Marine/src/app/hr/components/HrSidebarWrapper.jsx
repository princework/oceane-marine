"use client";

import { Suspense } from "react";
import HrSidebar from "./HrSidebar";
import SideBarSkeleton from "./SideBarSkeleton";

export default function HrSidebarWrapper() {
  return (
    <Suspense fallback={<SideBarSkeleton />}>
      <HrSidebar />
    </Suspense>
  );
}
