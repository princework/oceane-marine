import { Suspense } from "react";
import BeforeRunInMooringChecklist from "./BeforeRunInMooringChecklist.js"

export default function STSChecklist2BPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist OPS-OFD-002 page…
            </p>
          </div>
        }
      >
        <BeforeRunInMooringChecklist />
      </Suspense>
    </div>
  );
}
