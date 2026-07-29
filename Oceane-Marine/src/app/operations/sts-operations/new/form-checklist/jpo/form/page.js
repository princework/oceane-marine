import { Suspense } from "react";
import JpoFormPage from "./JpoFormPage";

export default function JpoFormPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <p className="text-white/60">
            Loading JPO form page…
          </p>
        </div>
      }
    >
      <JpoFormPage />
    </Suspense>
  );
}
