import { Suspense } from "react";
import LegacyTransferLocationUploadsPage from "./LegacyTransferLocationUploadsPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function LegacyTransferLocationUploadsPageWrapper() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
        <LegacyTransferLocationUploadsPage />
      </Suspense>
  );
}
