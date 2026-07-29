import { Suspense } from "react";
import STSChecklist6AB from "./STSChecklist6AB";

export default function STSChecklist3A3BPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist 6AB page…
            </p>
          </div>
        }
      >
        <STSChecklist6AB />
      </Suspense>
    </div>
  );
}
