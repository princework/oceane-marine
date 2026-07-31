import { Suspense } from "react";
import VendorOnboardingDashboardPage from "./VendorOnboardingDashboardPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function VendorOnboardingDashboardPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <VendorOnboardingDashboardPage />
      </Suspense>
  );
}
