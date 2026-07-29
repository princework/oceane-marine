import { Suspense } from "react";
import RecordOfWorkHours from "./RecordOfWorkHours";

export default function RecordOfWorkHoursPage() {
  return (
    <div>
      <Suspense
        fallback={
          <div>
            <p className="text-white/60">
              Loading Record of Work Hours…
            </p>
          </div>
        }
      >
        <RecordOfWorkHours />
      </Suspense>
    </div>
  );
}
