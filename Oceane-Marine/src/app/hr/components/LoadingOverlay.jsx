"use client";

import OrangeFullPageLoader from "@/app/components/OrangeFullPageLoader";
import { useHrLoading } from "../HrLoadingContext";

export default function LoadingOverlay() {
  const { pageLoading } = useHrLoading();

  if (!pageLoading) return null;

  return <OrangeFullPageLoader />;
}
