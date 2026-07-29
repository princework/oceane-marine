import { Suspense } from "react";
import ManualFormPage from "./ManualFormPage";

export default function ManualFormPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <p className="text-white/60">
            Loading manual form page…
          </p>
        </div>
      }
    >
      <ManualFormPage />
    </Suspense>
  );
}
