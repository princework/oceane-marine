import { Suspense } from "react";
import STSChecklist3A3B from "./STSChecklist3A3B";

export default function STSChecklist3A3BPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist 3A3B page…
            </p>
          </div>
        }
      >
        <STSChecklist3A3B />
      </Suspense>
    </div>
  );
}
