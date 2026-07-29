"use client";

import dynamic from "next/dynamic";

// Leaflet must be loaded client-side only (no SSR)
const OperationsMap = dynamic(() => import("./OperationsMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-4">Operations Map</h2>
      <div className="w-full h-[380px] rounded-xl border border-white/10 flex items-center justify-center bg-slate-800/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    </div>
  ),
});

export default OperationsMap;
