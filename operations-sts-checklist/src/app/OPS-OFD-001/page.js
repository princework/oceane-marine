import { Suspense } from "react";
import BeforeOperationCommenceChecklist from "./BeforeOperationCommenceChecklist";

export default function BeforeOperationCommenceChecklistPage() {
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
        <BeforeOperationCommenceChecklist />
      </Suspense>
    </div>
  );
}
