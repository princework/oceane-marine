"use client";

import { Suspense } from "react";
import StsQuotationFormPage from "./StsQuotationFormPage";

export default function StsQuotationFormRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <p className="text-white/60">Loading…</p>
        </div>
      }
    >
      <StsQuotationFormPage />
    </Suspense>
  );
}
