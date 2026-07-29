"use client";

import OrangeFullPageLoader from "@/app/components/OrangeFullPageLoader";
import { useOperationsLoading } from "../OperationsLoadingContext";

export default function LoadingOverlay() {
  const { pageLoading } = useOperationsLoading();

  if (!pageLoading) return null;

  return <OrangeFullPageLoader />;
}
