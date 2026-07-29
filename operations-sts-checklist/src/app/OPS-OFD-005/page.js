import { Suspense } from "react";
import STSChecklist5AC from "./STSChecklist5AC";

export default function STSChecklist5ACPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist 5AC page…
            </p>
          </div>
        }
      >
        <STSChecklist5AC />
      </Suspense>
    </div>
  );
}
