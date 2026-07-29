"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

const PMS_BG = "/bg-image/pms/pms-bg.jpeg";

export default function PmsLayoutClient({ children }) {
  useEffect(() => {
    void useAuthStore.getState().fetchUser();
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent text-white pt-6">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-sm"
          style={{ backgroundImage: `url('${PMS_BG}')` }}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-slate-950/70" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
