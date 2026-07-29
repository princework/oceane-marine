import { Suspense } from "react";
import InspectionChecklist from "./InspectionChecklistFormPage";

export default function InspectionChecklistFormPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <p className="text-white/60">
            Loading inspection checklist form page…
          </p>
        </div>
      }
    >
      <InspectionChecklist />
    </Suspense>
  );
}
