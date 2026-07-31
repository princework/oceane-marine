"use client";

import { Suspense } from "react";
import VendorSupplyFormClient from "./VendorSupplyFormClient";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorSupplyFormPage() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <VendorSupplyFormClient />
      </Suspense>
  );
}
