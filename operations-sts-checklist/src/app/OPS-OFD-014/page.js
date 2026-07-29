import { Suspense } from "react";
import STSEquipmentChecklist from "./STSEquipmentChecklist";

export default function STSEquipmentChecklistPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Equipment Checklist page…
            </p>
          </div>
        }
      >
        <STSEquipmentChecklist />
      </Suspense>
    </div>
  );
}
