import { Suspense } from "react";
import DashboardPage from "./DashboardPage";

export default function DashboardPageWrapper() {
  return (
    <div>
      {/* Main content */}
      <Suspense
        fallback={
          <div>
            <p className="text-white/60">
              Loading dashboard page…
            </p>
          </div>
        }
      >
        <DashboardPage />
      </Suspense>
    </div>
  );
}
