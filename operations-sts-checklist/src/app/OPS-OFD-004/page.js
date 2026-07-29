import { Suspense } from "react";
import STSChecklist4AF from "./STSChecklist4AF";

export default function STSChecklist3A3BPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Checklist 4AF page…
            </p>
          </div>
        }
      >
        <STSChecklist4AF />
      </Suspense>
    </div>
  );
}
