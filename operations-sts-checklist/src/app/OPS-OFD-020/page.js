import { Suspense } from "react";
import MasterFeedbackForm from "./MasterFeedbackForm";

export default function MasterFeedbackFormPage() {
  return (
    <div>
      <Suspense
        fallback={
          <div>
            <p className="text-white/60">
              Loading Master&apos;s Feedback Form…
            </p>
          </div>
        }
      >
        <MasterFeedbackForm />
      </Suspense>
    </div>
  );
}
