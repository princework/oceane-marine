import { Suspense } from "react";
import MooringMastersJobReport from "./MooringMastersJobReport";

export default function MooringMastersJobReportPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading Mooring Masters Job Report page…
            </p>
          </div>
        }
      >
        <MooringMastersJobReport />
      </Suspense>
    </div>
  );
}
