import { Suspense } from "react";
import STSChecklist8 from "./STSChecklist8";

export default function STSChecklist8Page() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading Personnel Transfer Basket Checklist page…
            </p>
          </div>
        }
      >
        <STSChecklist8 />
      </Suspense>
    </div>
  );
}
