"use client";

import { Suspense } from "react";
import TransferLocationQuestFormContent from "./TransferLocationQuestFormPage";
import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";

export default function TransferLocationQuestFormPage() {
  return (
    <Suspense fallback={<QhseSuspenseFallback />}>
      <TransferLocationQuestFormContent />
    </Suspense>
  );
}
