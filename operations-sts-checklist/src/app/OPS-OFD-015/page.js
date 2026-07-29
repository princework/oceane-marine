import { Suspense } from "react";
import STSHourlyQuantityLog from "./STSHourlyQuantityLog";

export default function STSHourlyQuantityLogPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading STS Hourly Quantity Log page…
            </p>
          </div>
        }
      >
        <STSHourlyQuantityLog />
      </Suspense>
    </div>
  );
}
