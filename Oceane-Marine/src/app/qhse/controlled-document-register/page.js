import ControlledDocumentRegisterPage from "./ControlledDocumentRegisterPage";
import { Suspense } from "react";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function ControlledDocumentRegisterRoute() {
  return (
    <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <ControlledDocumentRegisterPage />
      </Suspense>
  );
}
