"use client";

import { Suspense } from "react";
import QhseSidebar from "../../../components/QhseSidebar";
import VendorSupplyFormClient from "./VendorSupplyFormClient";
import SideBarSkeleton from "../../../components/SideBarSkeleton";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorSupplyFormPage() {
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
        <VendorSupplyFormClient />
      </Suspense>
    </div>
  );
}
