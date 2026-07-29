import { Suspense } from "react";
import NewOperationPage from "./NewOperationPage";

export default function NewOperationPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <p className="text-white/60">
              Loading new operation page…
          </p>
        </div>
      }
    >
      <NewOperationPage />
    </Suspense>
  );
}
