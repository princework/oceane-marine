import { Suspense } from "react";
import STSTimesheet from "./STSTimesheet";

export default function STSTimesheetPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Timesheet page…
            </p>
          </div>
        }
      >
        <STSTimesheet />
      </Suspense>
    </div>
  );
}
