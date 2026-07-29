"use client";

import { useEffect } from "react";
import { HrSidebarProvider } from "./HrSidebarContext";
import { HrLoadingProvider, useHrLoading } from "./HrLoadingContext";
import LoadingOverlay from "./components/LoadingOverlay";
import { useAuthStore } from "@/store/authStore";

const HR_BG = "/bg-image/HR/hr-bg.jpeg";

function ContentWrapper({ children }) {
  const { pageLoading } = useHrLoading();
  return (
    <div
      className={`relative z-10 min-h-screen bg-transparent text-white transition-all duration-300 ${pageLoading ? "blur-sm pointer-events-none" : ""}`}
    >
      {children}
    </div>
  );
}

export default function HrLayoutClient({ children }) {
  useEffect(() => {
    void useAuthStore.getState().fetchUser();
  }, []);

  return (
    <HrLoadingProvider>
      <HrSidebarProvider>
        <div className="relative min-h-screen bg-transparent text-white pt-6">
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
            <div
              className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-sm"
              style={{ backgroundImage: `url('${HR_BG}')` }}
            />
          </div>
          <div className="pointer-events-none fixed inset-0 z-[1] bg-slate-950/70" aria-hidden />
          <ContentWrapper>{children}</ContentWrapper>
        </div>
        <LoadingOverlay />
      </HrSidebarProvider>
    </HrLoadingProvider>
  );
}
