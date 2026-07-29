"use client";

import { Suspense } from "react";
import QhseSidebar from "./QhseSidebar";
import SideBarSkeleton from "./SideBarSkeleton";

export default function QhseSidebarWrapper() {
  return (
    <Suspense fallback={<SideBarSkeleton />}>
      <QhseSidebar />
    </Suspense>
  );
}


