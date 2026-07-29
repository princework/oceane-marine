"use client";

import OrangeFullPageLoader from "@/app/components/OrangeFullPageLoader";
import { useQhseLoading } from "../QhseLoadingContext";

export default function QhseLoadingOverlay() {
  const { pageLoading } = useQhseLoading();

  if (!pageLoading) return null;

  return <OrangeFullPageLoader />;
}
