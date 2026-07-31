import { Suspense } from "react";
import TransferLocationQuestListPage from "./TransferLocationQuestListPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function TransferLocationQuestListPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <TransferLocationQuestListPage />
      </Suspense>
  );
}
