import { Suspense } from "react";
import DrillsListClient from "./DrillsListClient";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function DrillsListPage() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <DrillsListClient />
      </Suspense>
  );
}
