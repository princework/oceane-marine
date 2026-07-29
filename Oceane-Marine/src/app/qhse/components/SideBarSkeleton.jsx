"use client";

export default function SidebarSkeleton() {
  return (
    <div
      className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] z-50
        bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
        border-r border-white/15 shadow-2xl overflow-hidden`}
    >
      {/* Shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.6s_infinite]" />

      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400/30 to-orange-600/30" />
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/20" />
              <div className="h-2 w-16 rounded bg-white/10" />
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-11 rounded-xl bg-white/15 px-4 flex items-center">
                <div className="h-3 w-28 rounded bg-white/30" />
              </div>
              <div className="ml-4 space-y-2">
                <div className="h-9 w-[85%] rounded-lg bg-white/10" />
                <div className="h-9 w-[70%] rounded-lg bg-white/10" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="h-2 w-28 mx-auto rounded bg-white/10" />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
