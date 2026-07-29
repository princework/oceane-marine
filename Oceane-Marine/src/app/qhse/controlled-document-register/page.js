import ControlledDocumentRegisterPage from "./ControlledDocumentRegisterPage";
import { Suspense } from "react";
import QhseSidebar from "../components/QhseSidebar";
import SideBarSkeleton from "../components/SideBarSkeleton";

import QhseSuspenseFallback from "@/app/qhse/components/QhseSuspenseFallback";
export default function ControlledDocumentRegisterRoute() {
  return (
    <div className="min-h-screen bg-transparent text-white flex">
      <Suspense fallback={<SideBarSkeleton />}>
        <QhseSidebar />
      </Suspense>
      <Suspense
        fallback={<QhseSuspenseFallback />}
      >
        <ControlledDocumentRegisterPage />
      </Suspense>
    </div>
  );
}
