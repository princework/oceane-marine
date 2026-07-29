"use client";

import { useEffect } from "react";
import { useQhseLoading } from "../QhseLoadingContext";

/**
 * Use as Suspense fallback under QHSE layout: shows the same full-screen loader as HR
 * while lazy chunks / useSearchParams resolve.
 */
export default function QhseSuspenseFallback() {
  const { setPageLoading } = useQhseLoading();

  useEffect(() => {
    setPageLoading(true);
    return () => setPageLoading(false);
  }, [setPageLoading]);

  return <div className="flex-1 min-w-0 min-h-[50vh]" aria-hidden />;
}
