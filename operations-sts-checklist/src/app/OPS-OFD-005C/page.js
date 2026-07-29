import { Suspense } from "react";
import STSChecklist5C from "./STSChecklist5C";

export default function STSChecklist5CPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist 5C page…
            </p>
          </div>
        }
      >
        <STSChecklist5C />
      </Suspense>
    </div>
  );
}
