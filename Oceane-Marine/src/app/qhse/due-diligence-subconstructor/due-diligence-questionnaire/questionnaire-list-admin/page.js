import { Suspense } from "react";
import QuestionnaireListAdminPage from "./QuestionnaireListAdminPage";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function QuestionnaireListAdminPageWrapper() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <QuestionnaireListAdminPage />
      </Suspense>
  );
}
