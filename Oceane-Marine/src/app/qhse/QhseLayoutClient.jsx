"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { QhseSidebarProvider } from "./QhseSidebarContext";
import { QhseLoadingProvider, useQhseLoading } from "./QhseLoadingContext";
import QhseLoadingOverlay from "./components/QhseLoadingOverlay";
import QhseSidebarWrapper from "./components/QhseSidebarWrapper";

const QHSE_BG = "/bg-image/qhse/bg.jpeg";

function QhseLayoutInner({ children }) {
  const { pageLoading } = useQhseLoading();
  useEffect(() => {
    void useAuthStore.getState().fetchUser();
  }, []);
  return (
    <div
      className={`relative min-h-screen bg-transparent text-white pt-6 transition-all duration-300 ${
        pageLoading ? "blur-sm pointer-events-none" : ""
      }`}
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-sm"
          style={{ backgroundImage: `url('${QHSE_BG}')` }}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-slate-950/70" aria-hidden />
      <div className="relative z-10 flex min-h-screen bg-transparent text-white">
        <QhseSidebarWrapper />
        {children}
      </div>
    </div>
  );
}

export default function QhseLayoutClient({ children }) {
  return (
    <QhseLoadingProvider>
      <QhseSidebarProvider>
        <QhseLayoutInner>{children}</QhseLayoutInner>
        <QhseLoadingOverlay />
      </QhseSidebarProvider>
    </QhseLoadingProvider>
  );
}
