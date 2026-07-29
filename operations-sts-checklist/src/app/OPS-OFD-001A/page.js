import { Suspense } from "react";
import ShipStandardQuestionnaire from "./ShipStandardQuestionnaire";

export default function ShipStandardQuestionnairePage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading best practice create page…
            </p>
          </div>
        }
      >
        <ShipStandardQuestionnaire />
      </Suspense>
    </div>
  );
}
