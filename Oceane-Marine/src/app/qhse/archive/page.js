import ArchivePage from "./ArchivePage";
import { Suspense } from "react";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";

export default function ArchiveRoute() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <ArchivePage />
      </Suspense>
  );
}
